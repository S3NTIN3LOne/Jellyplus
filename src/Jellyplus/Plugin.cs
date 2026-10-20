using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyplus;

public sealed class Configuration : BasePluginConfiguration
{
    public bool SeasonalRecommendations { get; set; } = true;
    public bool ShuffleOpensDetails { get; set; }
}

public sealed class Plugin : BasePlugin<Configuration>, IHasWebPages
{
    public static Plugin Instance { get; private set; } = null!;
    public Plugin(IApplicationPaths paths, IXmlSerializer serializer) : base(paths, serializer)
    {
        Instance = this;
    }
    public override string Name => "Jelly+";
    public override string Description => "Gemeinsamer Fortschritt und persönliche Startseite für Jellyfin.";
    public override Guid Id => Guid.Parse("d357e8be-6be8-46b5-bd30-15a530412cd9");
    public IEnumerable<PluginPageInfo> GetPages() => [new()
    {
        Name = "Jellyplus", EmbeddedResourcePath = "Jellyplus.Web.config.html"
    }];
}
