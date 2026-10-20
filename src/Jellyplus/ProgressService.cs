using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Entities;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyplus;

public sealed record Progress(Guid Item, long Position, bool Played, int Count, DateTime? LastPlayed);
public sealed record Preview(Guid Scope, string Revision, bool Conflict, IReadOnlyList<Progress> Yours, IReadOnlyList<Progress> Theirs, int Members);

public sealed class ProgressService(StateStore store, IUserManager users, ILibraryManager library,
    IUserDataManager data, ILogger<ProgressService> logger) : IHostedService
{
    private readonly object _gate = new();
    private readonly AsyncLocal<bool> _copying = new();
    public Task StartAsync(CancellationToken token) { data.UserDataSaved += OnSaved; return Task.CompletedTask; }
    public Task StopAsync(CancellationToken token) { data.UserDataSaved -= OnSaved; return Task.CompletedTask; }
    public User User(Guid id) => users.GetUserById(id) ?? throw new ArgumentException("Profil nicht gefunden.");
    public BaseItem Accessible(Guid user, Guid id)
    {
        var item = library.GetItemById(id);
        if (item is null || !item.IsVisibleStandalone(User(user))) throw new UnauthorizedAccessException("Medium nicht verfügbar.");
        return item;
    }
    public BaseItem Scope(Guid user, Guid id)
    {
        var item = Accessible(user, id);
        if (item is Episode episode) item = Accessible(user, episode.SeriesId);
        if (item is not Movie && item is not Series) throw new ArgumentException("Bitte einen Film oder eine Serie auswählen.");
        return item;
    }
    private IReadOnlyList<BaseItem> Items(User user, BaseItem scope) => scope is Series
        ? library.GetItemList(new InternalItemsQuery(user) { AncestorIds = [scope.Id], Recursive = true, IncludeItemTypes = [BaseItemKind.Episode] })
        : [scope];
    private Progress Snapshot(User user, BaseItem item)
    {
        var d = data.GetUserData(user, item);
        return new(item.Id, d?.PlaybackPositionTicks ?? 0, d?.Played ?? false, d?.PlayCount ?? 0, d?.LastPlayedDate);
    }
    private void CheckPair(Guid me, Guid other)
    {
        if (me == other) throw new ArgumentException("Zwei unterschiedliche Profile auswählen.");
        User(me); User(other);
        if (!store.Read(s => s.Enabled.Contains(me) && s.Enabled.Contains(other)))
            throw new UnauthorizedAccessException("Watch Together muss bei beiden Profilen aktiviert sein.");
    }
    public Preview Preview(Guid me, Guid other, Guid id)
    {
        lock (_gate)
        {
            CheckPair(me, other);
            var scope = Scope(me, id);
            Accessible(other, scope.Id);
            var mine = Items(User(me), scope).Where(i => i.IsVisibleStandalone(User(other))).OrderBy(i => i.Id).ToArray();
            var yours = mine.Select(i => Snapshot(User(me), i)).ToArray();
            var theirs = mine.Select(i => Snapshot(User(other), i)).ToArray();
            var members = store.Read(s => Rules.Group(s, scope.Id, me).Union(Rules.Group(s, scope.Id, other)).Order().ToArray());
            var snapshots = members.Select(u => new { User = u, Items = mine.Where(i => i.IsVisibleStandalone(User(u))).Select(i => Snapshot(User(u), i)).ToArray() }).ToArray();
            var revision = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(snapshots))));
            return new(scope.Id, revision, yours.Zip(theirs).Any(pair => pair.First.Position != pair.Second.Position || pair.First.Played != pair.Second.Played), yours, theirs, members.Length);
        }
    }
    public void Link(Guid me, Guid other, Guid id, Guid source, string revision)
    {
        lock (_gate)
        {
            var preview = Preview(me, other, id);
            if (source != me && source != other) throw new ArgumentException("Ungültiges Quellprofil.");
            if (preview.Revision != revision) throw new InvalidOperationException("Der Fortschritt wurde inzwischen geändert. Bitte erneut auswählen.");
            var scope = Scope(me, preview.Scope);
            var members = store.Read(s => Rules.Group(s, scope.Id, me).Union(Rules.Group(s, scope.Id, other)).ToArray());
            // Copy first; on failure no active link is persisted. Retrying reconciles partial copies.
            _copying.Value = true;
            try
            {
                foreach (var item in Items(User(source), scope))
                {
                    if (!item.IsVisibleStandalone(User(me)) || !item.IsVisibleStandalone(User(other))) continue;
                    var progress = Snapshot(User(source), item);
                    foreach (var target in members.Where(u => u != source)) Copy(progress, item, target);
                }
                store.Update(s =>
                {
                    if (!s.Enabled.Contains(me) || !s.Enabled.Contains(other)) throw new InvalidOperationException("Profilfreigabe wurde geändert.");
                    if (!s.Links.Any(l => l.Item == scope.Id && ((l.First == me && l.Second == other) || (l.First == other && l.Second == me))))
                        s.Links.Add(new(scope.Id, me, other));
                });
            }
            finally { _copying.Value = false; }
        }
    }
    public void Enable(Guid me, bool enabled)
    {
        lock (_gate) store.Update(s =>
        {
            if (enabled) s.Enabled.Add(me);
            else { s.Enabled.Remove(me); s.Links.RemoveAll(l => l.First == me || l.Second == me); }
        });
    }
    public void Unlink(Guid me, Guid other, Guid id)
    {
        lock (_gate)
        {
            var scope = Scope(me, id);
            store.Update(s => s.Links.RemoveAll(l => l.Item == scope.Id && ((l.First == me && l.Second == other) || (l.Second == me && l.First == other))));
        }
    }
    public void Hide(Guid me, Guid id)
    {
        var item = Accessible(me, id);
        var scope = Scope(me, id);
        lock (_gate)
        {
            // A Next Up card usually points at an unstarted episode. Remember the
            // last episode actually played, so starting that Next Up episode restores it.
            var lastItem = scope is Series
                ? Items(User(me), scope).Select(i => Snapshot(User(me), i))
                    .Where(p => p.LastPlayed.HasValue || p.Position > 0 || p.Played)
                    .OrderByDescending(p => p.LastPlayed).FirstOrDefault()?.Item ?? Guid.Empty
                : item.Id;
            store.Update(s =>
            {
                s.Hidden.RemoveAll(h => h.User == me && h.Scope == scope.Id);
                s.Hidden.Add(new(me, scope.Id, lastItem));
            });
        }
    }
    private void Copy(Progress source, BaseItem item, Guid target)
    {
        var user = users.GetUserById(target);
        if (user is null || !item.IsVisibleStandalone(user)) return;
        var d = data.GetUserData(user, item) ?? new UserItemData { Key = item.GetUserDataKeys().First() };
        d.PlaybackPositionTicks = source.Position;
        d.Played = source.Played;
        d.PlayCount = source.Count;
        d.LastPlayedDate = source.LastPlayed;
        // Favorites, ratings and stream preferences always stay personal.
        data.SaveUserData(user, item, d, UserDataSaveReason.Import, CancellationToken.None);
    }
    private void OnSaved(object? sender, UserDataSaveEventArgs e)
    {
        if (_copying.Value || e.Item is not (Movie or Episode) || e.SaveReason is UserDataSaveReason.UpdateUserRating or UserDataSaveReason.Import) return;
        lock (_gate)
        {
            try
            {
                var scope = e.Item is Episode episode ? episode.SeriesId : e.Item.Id;
                // Starting a different episode brings a series back. A movie returns on playback start.
                if (e.SaveReason == UserDataSaveReason.PlaybackStart && store.Read(s => s.Hidden.Any(h => h.User == e.UserId && h.Scope == scope && (e.Item is Movie || h.LastItem != e.Item.Id))))
                    store.Update(s => s.Hidden.RemoveAll(h => h.User == e.UserId && h.Scope == scope && (e.Item is Movie || h.LastItem != e.Item.Id)));
                if (!store.Read(s => s.Enabled.Contains(e.UserId))) return;
                var group = store.Read(s => Rules.Group(s, scope, e.UserId));
                var d = e.UserData;
                var progress = new Progress(e.Item.Id, d.PlaybackPositionTicks, d.Played, d.PlayCount, d.LastPlayedDate);
                _copying.Value = true;
                foreach (var target in group.Where(u => u != e.UserId)) Copy(progress, e.Item, target);
            }
            catch (Exception error) { logger.LogError(error, "Jelly+ could not synchronize progress for item {Item}", e.Item.Id); }
            finally { _copying.Value = false; }
        }
    }
}
