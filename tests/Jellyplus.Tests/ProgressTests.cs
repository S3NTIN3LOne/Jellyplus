using Jellyfin.Database.Implementations.Entities;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Jellyplus.Tests;

public sealed class ProgressTests : IDisposable
{
    private readonly string _path = Path.Combine(Path.GetTempPath(), "jellyplus-progress-" + Guid.NewGuid());
    private readonly User _a = new("A", "auth", "reset"), _b = new("B", "auth", "reset");
    private readonly Mock<Movie> _movie = new();
    private readonly Mock<IUserDataManager> _data = new();
    private readonly Mock<ILibraryManager> _library = new();
    private readonly Dictionary<Guid, UserItemData> _values;
    private readonly StateStore _store;
    private readonly ProgressService _service;

    public ProgressTests()
    {
        var paths = new Mock<IApplicationPaths>(); paths.SetupGet(p => p.DataPath).Returns(_path);
        _store = new StateStore(paths.Object);
        var users = new Mock<IUserManager>();
        users.Setup(u => u.GetUserById(_a.Id)).Returns(_a); users.Setup(u => u.GetUserById(_b.Id)).Returns(_b);
        _movie.Object.Id = Guid.NewGuid();
        _movie.Setup(i => i.IsVisibleStandalone(It.IsAny<User>())).Returns(true);
        var library = _library; library.Setup(l => l.GetItemById(_movie.Object.Id)).Returns(_movie.Object);
        _values = new() {
            [_a.Id] = new() { Key = "movie", PlaybackPositionTicks = 100, Played = false },
            [_b.Id] = new() { Key = "movie", PlaybackPositionTicks = 200, Played = true, IsFavorite = true, AudioStreamIndex = 3 }
        };
        _data.Setup(d => d.GetUserData(It.IsAny<User>(), It.IsAny<BaseItem>())).Returns((User u, BaseItem _) => _values[u.Id]);
        _data.Setup(d => d.SaveUserData(It.IsAny<User>(), It.IsAny<BaseItem>(), It.IsAny<UserItemData>(), It.IsAny<UserDataSaveReason>(), It.IsAny<CancellationToken>()))
            .Callback((User u, BaseItem i, UserItemData d, UserDataSaveReason r, CancellationToken _) =>
            {
                _values[u.Id] = d;
                _data.Raise(m => m.UserDataSaved += null, new UserDataSaveEventArgs { UserId = u.Id, Item = i, UserData = d, SaveReason = r });
            });
        _service = new(_store, users.Object, library.Object, _data.Object, NullLogger<ProgressService>.Instance);
        _service.StartAsync(default).GetAwaiter().GetResult();
    }
    private void Enable() { _service.Enable(_a.Id, true); _service.Enable(_b.Id, true); }

    [Fact]
    public void BothProfilesMustOptInAndHaveAccess()
    {
        _service.Enable(_a.Id, true);
        Assert.Throws<UnauthorizedAccessException>(() => _service.Preview(_a.Id, _b.Id, _movie.Object.Id));
        _service.Enable(_b.Id, true);
        _movie.Setup(i => i.IsVisibleStandalone(_b)).Returns(false);
        Assert.Throws<UnauthorizedAccessException>(() => _service.Preview(_a.Id, _b.Id, _movie.Object.Id));
    }
    [Fact]
    public void SelectedProgressCopiesBothWaysWithoutCopyingFavoritesOrRecursing()
    {
        Enable();
        var preview = _service.Preview(_a.Id, _b.Id, _movie.Object.Id);
        Assert.True(preview.Conflict);
        _service.Link(_a.Id, _b.Id, _movie.Object.Id, _a.Id, preview.Revision);
        Assert.Equal(100, _values[_b.Id].PlaybackPositionTicks);
        Assert.False(_values[_b.Id].Played);
        Assert.True(_values[_b.Id].IsFavorite);
        Assert.Equal(3, _values[_b.Id].AudioStreamIndex);
        _values[_b.Id].PlaybackPositionTicks = 450;
        _values[_b.Id].Played = true;
        _data.Raise(d => d.UserDataSaved += null, new UserDataSaveEventArgs { UserId = _b.Id, Item = _movie.Object, UserData = _values[_b.Id], SaveReason = UserDataSaveReason.PlaybackFinished });
        Assert.Equal(450, _values[_a.Id].PlaybackPositionTicks);
        Assert.True(_values[_a.Id].Played);
        Assert.False(_values[_a.Id].IsFavorite);
    }
    [Fact]
    public void StaleConflictDecisionIsRejected()
    {
        Enable(); var preview = _service.Preview(_a.Id, _b.Id, _movie.Object.Id);
        _values[_b.Id].PlaybackPositionTicks++;
        Assert.Throws<InvalidOperationException>(() => _service.Link(_a.Id, _b.Id, _movie.Object.Id, _a.Id, preview.Revision));
        Assert.Empty(_store.Read(s => s.Links));
    }
    [Fact]
    public void DisablingRemovesLinksAndStopsSync()
    {
        Enable(); var preview = _service.Preview(_a.Id, _b.Id, _movie.Object.Id);
        _service.Link(_a.Id, _b.Id, _movie.Object.Id, _a.Id, preview.Revision);
        _service.Enable(_b.Id, false);
        Assert.Empty(_store.Read(s => s.Links));
        _values[_a.Id].PlaybackPositionTicks = 999;
        _data.Raise(d => d.UserDataSaved += null, new UserDataSaveEventArgs { UserId = _a.Id, Item = _movie.Object, UserData = _values[_a.Id], SaveReason = UserDataSaveReason.PlaybackProgress });
        Assert.Equal(100, _values[_b.Id].PlaybackPositionTicks);
    }
    [Fact]
    public void HiddenMovieReturnsOnPlaybackButNotOnRatingChange()
    {
        _service.Hide(_a.Id, _movie.Object.Id);
        _data.Raise(d => d.UserDataSaved += null, new UserDataSaveEventArgs { UserId = _a.Id, Item = _movie.Object, UserData = _values[_a.Id], SaveReason = UserDataSaveReason.UpdateUserRating });
        Assert.Single(_store.Read(s => s.Hidden));
        _data.Raise(d => d.UserDataSaved += null, new UserDataSaveEventArgs { UserId = _a.Id, Item = _movie.Object, UserData = _values[_a.Id], SaveReason = UserDataSaveReason.PlaybackStart });
        Assert.Empty(_store.Read(s => s.Hidden));
    }
    [Fact]
    public void HidingNextUpReturnsWhenThatUnstartedEpisodeBegins()
    {
        var series = new Mock<Series>(); series.Object.Id = Guid.NewGuid();
        var prior = new Mock<Episode>(); prior.Object.Id = Guid.NewGuid(); prior.Object.SeriesId = series.Object.Id;
        var next = new Mock<Episode>(); next.Object.Id = Guid.NewGuid(); next.Object.SeriesId = series.Object.Id;
        series.Setup(i => i.IsVisibleStandalone(It.IsAny<User>())).Returns(true);
        prior.Setup(i => i.IsVisibleStandalone(It.IsAny<User>())).Returns(true);
        next.Setup(i => i.IsVisibleStandalone(It.IsAny<User>())).Returns(true);
        _library.Setup(l => l.GetItemById(series.Object.Id)).Returns(series.Object);
        _library.Setup(l => l.GetItemById(next.Object.Id)).Returns(next.Object);
        _library.Setup(l => l.GetItemList(It.IsAny<InternalItemsQuery>())).Returns(new BaseItem[] { prior.Object, next.Object });
        var played = new UserItemData { Key = "prior", Played = true, LastPlayedDate = DateTime.UtcNow };
        var unstarted = new UserItemData { Key = "next" };
        _data.Setup(d => d.GetUserData(_a, prior.Object)).Returns(played);
        _data.Setup(d => d.GetUserData(_a, next.Object)).Returns(unstarted);
        _service.Hide(_a.Id, next.Object.Id);
        _data.Raise(d => d.UserDataSaved += null, new UserDataSaveEventArgs { UserId = _a.Id, Item = prior.Object, UserData = played, SaveReason = UserDataSaveReason.PlaybackStart });
        Assert.Single(_store.Read(s => s.Hidden));
        _data.Raise(d => d.UserDataSaved += null, new UserDataSaveEventArgs { UserId = _a.Id, Item = next.Object, UserData = unstarted, SaveReason = UserDataSaveReason.PlaybackStart });
        Assert.Empty(_store.Read(s => s.Hidden));
    }
    [Fact]
    public void HiddenCardResolutionIsScopedToAuthenticatedUserAndVisibleItems()
    {
        _service.Hide(_a.Id, _movie.Object.Id);
        var controller = new JellyplusController(_store, _service, Mock.Of<IUserManager>(), _library.Object);
        var context = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        context.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(
            [new System.Security.Claims.Claim("Jellyfin-UserId", _b.Id.ToString())], "test"));
        controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = context };
        Assert.Empty(Assert.IsType<Guid[]>(Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(controller.ResolveHidden([_movie.Object.Id])).Value));
        context.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(
            [new System.Security.Claims.Claim("Jellyfin-UserId", _a.Id.ToString())], "test"));
        Assert.Single(Assert.IsType<Guid[]>(Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(controller.ResolveHidden([_movie.Object.Id])).Value));
        _movie.Setup(i => i.IsVisibleStandalone(_a)).Returns(false);
        Assert.Empty(Assert.IsType<Guid[]>(Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(controller.ResolveHidden([_movie.Object.Id])).Value));
    }
    public void Dispose()
    {
        _service.StopAsync(default).GetAwaiter().GetResult();
        if (Directory.Exists(_path)) Directory.Delete(_path, true);
    }
}
