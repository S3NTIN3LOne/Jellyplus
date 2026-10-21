using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Hosting;
using Moq;
using Xunit;

namespace Jellyplus.Tests;

public sealed class WebTests
{
    [Theory]
    [InlineData("")]
    [InlineData("/jellyfin")]
    public async Task InjectsOnlyWebEntryAndLeavesFilesUntouched(string baseUrl)
    {
        var path = Path.Combine(Path.GetTempPath(), "jellyplus-web-" + Guid.NewGuid());
        Directory.CreateDirectory(path);
        var html = "<html><body>Jellyfin</body></html>";
        await File.WriteAllTextAsync(Path.Combine(path, "index.html"), html);
        var paths = new Mock<IServerApplicationPaths>(); paths.SetupGet(p => p.WebPath).Returns(path);
        var config = new Mock<IServerConfigurationManager>();
        config.SetupGet(c => c.ApplicationPaths).Returns(paths.Object);
        config.Setup(c => c.GetConfiguration("network")).Returns(new NetworkConfiguration { BaseUrl = baseUrl });
        try
        {
            using var host = await new HostBuilder().ConfigureWebHost(web => web.UseTestServer().Configure(app =>
                new WebStartupFilter(config.Object).Configure(a => a.Run(c => c.Response.WriteAsync("unchanged")))(app))).StartAsync();
            var client = host.GetTestClient();
            var response = await client.GetAsync(baseUrl + "/web/index.html");
            var body = await response.Content.ReadAsStringAsync();
            Assert.Contains("<script defer src=\"" + baseUrl + "/Jellyplus/client.js?v=" + typeof(Plugin).Assembly.GetName().Version + "\"></script></body>", body);
            Assert.Equal(html, await File.ReadAllTextAsync(Path.Combine(path, "index.html")));
            Assert.Equal("no-store", response.Headers.CacheControl!.ToString());
            Assert.Equal("unchanged", await client.GetStringAsync(baseUrl + "/Videos/1/stream"));
            Assert.Contains("__jellyplus", await client.GetStringAsync(baseUrl + "/Jellyplus/client.js"));
        }
        finally { Directory.Delete(path, true); }
    }
}
