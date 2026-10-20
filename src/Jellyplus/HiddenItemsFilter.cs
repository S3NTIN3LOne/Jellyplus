using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Querying;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Jellyplus;

// Filter only the two dedicated feeds; never change watched state or the library itself.
public sealed class HiddenItemsFilter(StateStore store) : IAsyncResultFilter
{
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        var action = (context.ActionDescriptor as ControllerActionDescriptor)?.ActionName;
        if (action is "GetNextUp" or "GetResumeItems" or "GetResumeItemsLegacy"
            && Guid.TryParse(context.HttpContext.User.FindFirst("Jellyfin-UserId")?.Value, out var user)
            && context.Result is ObjectResult { Value: QueryResult<BaseItemDto> result })
        {
            var requested = context.HttpContext.Request.Query["userId"].FirstOrDefault()
                ?? context.RouteData.Values.GetValueOrDefault("userId")?.ToString();
            if (Guid.TryParse(requested, out var requestedUser) && requestedUser != user)
            {
                await next();
                return;
            }
            var hidden = store.Read(s => s.Hidden.Where(h => h.User == user).Select(h => h.Scope).ToHashSet());
            var filtered = result.Items.Where(i => !hidden.Contains(i.SeriesId ?? i.Id)).ToArray();
            result.TotalRecordCount = Math.Max(0, result.TotalRecordCount - (result.Items.Count - filtered.Length));
            result.Items = filtered;
        }
        await next();
    }
}
