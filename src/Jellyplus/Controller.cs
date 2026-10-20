using Jellyfin.Data.Enums;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Dto;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Querying;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyplus;

public sealed record PreferenceRequest(bool Enabled);
public sealed record LinkRequest(Guid Other, Guid Source, string Revision);

[ApiController]
[Authorize]
[Route("Jellyplus")]
public sealed class JellyplusController(StateStore store, ProgressService progress, IUserManager users, ILibraryManager library) : ControllerBase
{
    private Guid Me => Guid.TryParse(User.FindFirst("Jellyfin-UserId")?.Value, out var id) && id != Guid.Empty
        ? id : throw new UnauthorizedAccessException("Ein Benutzerprofil ist erforderlich.");
    private ActionResult Execute(Func<object> action)
    {
        try { return Ok(action()); }
        catch (UnauthorizedAccessException e) { return StatusCode(403, new { Message = e.Message }); }
        catch (ArgumentException e) { return BadRequest(new { Message = e.Message }); }
        catch (InvalidOperationException e) { return Conflict(new { Message = e.Message }); }
    }

    [HttpGet("Settings")]
    public ActionResult Settings() => Execute(() => new
    {
        Enabled = store.Read(s => s.Enabled.Contains(Me)),
        Plugin.Instance.Configuration.SeasonalRecommendations,
        Plugin.Instance.Configuration.ShuffleOpensDetails,
        Hidden = store.Read(s => s.Hidden.Where(h => h.User == Me).Select(h => h.Scope).ToArray())
    });

    [HttpPut("Preferences")]
    public ActionResult Preferences(PreferenceRequest request) => Execute(() => { progress.Enable(Me, request.Enabled); return new { }; });

    [HttpGet("Profiles/{item:guid}")]
    public ActionResult Profiles(Guid item) => Execute(() =>
    {
        var scope = progress.Scope(Me, item);
        if (!store.Read(s => s.Enabled.Contains(Me))) throw new UnauthorizedAccessException("Watch Together zuerst aktivieren.");
        var enabled = store.Read(s => s.Enabled.ToArray());
        return users.GetUsers().Where(u => u.Id != Me && enabled.Contains(u.Id) && scope.IsVisibleStandalone(u))
            .Select(u => new { u.Id, u.Username, Linked = store.Read(s => s.Links.Any(l => l.Item == scope.Id && ((l.First == Me && l.Second == u.Id) || (l.Second == Me && l.First == u.Id)))) }).ToArray();
    });

    [HttpGet("Links/{item:guid}/Preview/{other:guid}")]
    public ActionResult Preview(Guid item, Guid other) => Execute(() => progress.Preview(Me, other, item));

    [HttpPost("Links/{item:guid}")]
    public ActionResult Link(Guid item, LinkRequest request) => Execute(() =>
    {
        progress.Link(Me, request.Other, item, request.Source, request.Revision);
        return new { };
    });

    [HttpDelete("Links/{item:guid}/{other:guid}")]
    public ActionResult Unlink(Guid item, Guid other) => Execute(() => { progress.Unlink(Me, other, item); return new { }; });

    [HttpPost("Hidden/{item:guid}")]
    public ActionResult Hide(Guid item) => Execute(() => { progress.Hide(Me, item); return new { }; });

    [HttpDelete("Hidden/{item:guid}")]
    public ActionResult Restore(Guid item) => Execute(() =>
    {
        var scope = progress.Scope(Me, item);
        store.Update(s => s.Hidden.RemoveAll(h => h.User == Me && h.Scope == scope.Id));
        return new { };
    });

    [HttpGet("Hidden")]
    public ActionResult Hidden() => Execute(() => store.Read(s => s.Hidden.Where(h => h.User == Me).ToArray())
        .Select(h => library.GetItemById(h.Scope)).Where(i => i is not null && i.IsVisibleStandalone(progress.User(Me)))
        .Select(i => new { i!.Id, i.Name }).ToArray());

    [HttpPost("Hidden/Resolve")]
    public ActionResult ResolveHidden([FromBody] Guid[] items) => Execute(() =>
    {
        if (items.Length > 200) throw new ArgumentException("Zu viele Medien.");
        var user = progress.User(Me);
        var hidden = store.Read(s => s.Hidden.Where(h => h.User == Me).Select(h => h.Scope).ToHashSet());
        return items.Distinct().Select(id => library.GetItemById(id))
            .Where(i => i is not null && hidden.Contains(i is Episode episode ? episode.SeriesId : i.Id) && i.IsVisibleStandalone(user))
            .Select(i => i!.Id).ToArray();
    });

    [HttpGet("Seasonal")]
    public ActionResult Seasonal() => Execute(() =>
    {
        var season = Rules.Season(DateOnly.FromDateTime(DateTime.Now));
        if (!Plugin.Instance.Configuration.SeasonalRecommendations || season is null) return new { Title = "", Items = Array.Empty<object>() };
        var items = library.GetItemList(new InternalItemsQuery(progress.User(Me))
        {
            Recursive = true, IncludeItemTypes = [BaseItemKind.Movie],
            DtoOptions = new DtoOptions(false)
            {
                Fields = [ItemFields.Genres, ItemFields.Tags, ItemFields.Overview],
                EnableImages = false, EnableUserData = false
            }
        });
        return new
        {
            Title = season,
            Items = items.Where(i => Rules.Matches(season, i.Genres, i.Tags, i.Name, i.Overview))
                .OrderBy(i => i.SortName).Take(40).Select(i => new { i.Id, i.Name }).ToArray()
        };
    });
}
