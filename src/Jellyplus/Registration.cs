using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyplus;

public sealed class Registration : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection services, IServerApplicationHost host)
    {
        services.AddSingleton<StateStore>();
        services.AddSingleton<ProgressService>();
        services.AddHostedService(p => p.GetRequiredService<ProgressService>());
        services.AddTransient<IStartupFilter, WebStartupFilter>();
        services.AddTransient<HiddenItemsFilter>();
        services.Configure<Microsoft.AspNetCore.Mvc.MvcOptions>(o => o.Filters.AddService<HiddenItemsFilter>());
    }
}
