using System.Reflection;
using System.Text.Encodings.Web;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace Jellyplus;

public sealed class WebStartupFilter(IServerConfigurationManager configuration) : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use(async (context, following) =>
        {
            var prefix = configuration.GetNetworkConfiguration().BaseUrl.TrimEnd('/');
            var path = context.Request.Path.Value ?? "";
            var isIndex = path.Equals(prefix + "/web/index.html", StringComparison.OrdinalIgnoreCase)
                || path.Equals(prefix + "/web/", StringComparison.OrdinalIgnoreCase);
            var isScript = path.Equals(prefix + "/Jellyplus/client.js", StringComparison.OrdinalIgnoreCase);
            if ((!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)) || (!isIndex && !isScript))
            {
                await following(context);
                return;
            }
            string content;
            if (isScript)
            {
                using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Jellyplus.Web.client.js")!;
                using var reader = new StreamReader(stream);
                content = await reader.ReadToEndAsync(context.RequestAborted);
                context.Response.ContentType = "application/javascript; charset=utf-8";
            }
            else
            {
                var index = Path.Combine(configuration.ApplicationPaths.WebPath, "index.html");
                if (!File.Exists(index)) { await following(context); return; }
                content = await File.ReadAllTextAsync(index, context.RequestAborted);
                var marker = content.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
                if (marker < 0) { await following(context); return; }
                var source = HtmlEncoder.Default.Encode(prefix + "/Jellyplus/client.js?v=" + typeof(Plugin).Assembly.GetName().Version);
                content = content.Insert(marker, $"<script defer src=\"{source}\"></script>");
                context.Response.ContentType = "text/html; charset=utf-8";
            }
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers.XContentTypeOptions = "nosniff";
            if (!HttpMethods.IsHead(context.Request.Method)) await context.Response.WriteAsync(content, context.RequestAborted);
        });
        next(app);
    };
}
