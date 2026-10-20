using MediaBrowser.Common.Configuration;
using Moq;
using Xunit;

namespace Jellyplus.Tests;

public sealed class RulesTests
{
    [Theory]
    [InlineData(10, 14, null)] [InlineData(10, 15, "Halloween")]
    [InlineData(10, 31, "Halloween")] [InlineData(11, 1, "Halloween")]
    [InlineData(11, 2, null)] [InlineData(11, 30, null)]
    [InlineData(12, 1, "Weihnachten")] [InlineData(12, 31, "Weihnachten")]
    [InlineData(1, 1, null)]
    public void SeasonalBoundaries(int month, int day, string? expected) => Assert.Equal(expected, Rules.Season(new(2026, month, day)));

    [Fact]
    public void MatchesMetadataWithoutTreatingEveryFamilyFilmAsChristmas()
    {
        Assert.True(Rules.Matches("Halloween", ["Horror"], [], "", ""));
        Assert.True(Rules.Matches("Weihnachten", ["Family"], ["Christmas"], "", ""));
        Assert.True(Rules.Matches("Weihnachten", [], [], "", "Eine Geschichte an Heiligabend."));
        Assert.False(Rules.Matches("Weihnachten", ["Family"], [], "Finding Nemo", "Fish in the ocean"));
    }

    [Fact]
    public void GroupsAreScopedAndDisabledProfilesBreakPropagation()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid(); var c = Guid.NewGuid(); var scope = Guid.NewGuid();
        var state = new State { Enabled = [a, b, c], Links = [new(scope, a, b), new(scope, b, c), new(Guid.NewGuid(), a, Guid.NewGuid())] };
        Assert.Equal(3, Rules.Group(state, scope, a).Count);
        state.Enabled.Remove(b);
        Assert.Equal(new HashSet<Guid> { a }, Rules.Group(state, scope, a));
    }

    [Fact]
    public void StateSurvivesRestartAndFailedMutationDoesNotLeak()
    {
        var path = Path.Combine(Path.GetTempPath(), "jellyplus-test-" + Guid.NewGuid());
        var paths = new Mock<IApplicationPaths>(); paths.SetupGet(p => p.DataPath).Returns(path);
        try
        {
            var id = Guid.NewGuid(); var store = new StateStore(paths.Object);
            store.Update(s => s.Enabled.Add(id));
            Assert.Throws<InvalidOperationException>(() => store.Update(s => { s.Enabled.Clear(); throw new InvalidOperationException(); }));
            Assert.True(store.Read(s => s.Enabled.Contains(id)));
            Assert.True(new StateStore(paths.Object).Read(s => s.Enabled.Contains(id)));
        }
        finally { if (Directory.Exists(path)) Directory.Delete(path, true); }
    }
}
