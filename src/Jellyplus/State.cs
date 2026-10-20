using System.Text.Json;
using MediaBrowser.Common.Configuration;

namespace Jellyplus;

public sealed record Link(Guid Item, Guid First, Guid Second);
public sealed record Hidden(Guid User, Guid Scope, Guid LastItem);
public sealed class State
{
    public HashSet<Guid> Enabled { get; set; } = [];
    public List<Link> Links { get; set; } = [];
    public List<Hidden> Hidden { get; set; } = [];
}

// All reads and mutations are serialized, and failed writes never publish new state.
public sealed class StateStore
{
    private readonly object _gate = new();
    private readonly string _path;
    private State _state;
    public StateStore(IApplicationPaths paths)
    {
        _path = Path.Combine(paths.DataPath, "jellyplus", "state.json");
        _state = File.Exists(_path)
            ? JsonSerializer.Deserialize<State>(File.ReadAllText(_path)) ?? throw new InvalidDataException("Invalid Jelly+ state")
            : new();
    }
    public T Read<T>(Func<State, T> read) { lock (_gate) return read(_state); }
    public void Update(Action<State> change)
    {
        lock (_gate)
        {
            var next = JsonSerializer.Deserialize<State>(JsonSerializer.Serialize(_state))!;
            change(next);
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            var temp = _path + ".tmp";
            using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                JsonSerializer.Serialize(stream, next);
                stream.Flush(true);
            }
            File.Move(temp, _path, true);
            _state = next;
        }
    }
}

public static class Rules
{
    public static string? Season(DateOnly date) => date.Month == 12 ? "Weihnachten"
        : (date.Month == 10 && date.Day >= 15) || (date.Month == 11 && date.Day == 1) ? "Halloween" : null;

    public static bool Matches(string season, IEnumerable<string> genres, IEnumerable<string> tags, string? name, string? overview)
    {
        var text = string.Join(" ", genres.Concat(tags).Append(name ?? "").Append(overview ?? "")).ToLowerInvariant();
        string[] words = season == "Weihnachten"
            ? ["weihnacht", "christmas", "xmas", "santa claus", "advent", "heiligabend", "noël"]
            : ["halloween", "horror", "grusel", "spooky"];
        return words.Any(text.Contains);
    }

    public static HashSet<Guid> Group(State state, Guid scope, Guid user)
    {
        HashSet<Guid> group = [user];
        bool changed;
        do
        {
            changed = false;
            foreach (var link in state.Links.Where(l => l.Item == scope && state.Enabled.Contains(l.First) && state.Enabled.Contains(l.Second)))
            {
                if (!group.Contains(link.First) && !group.Contains(link.Second)) continue;
                changed |= group.Add(link.First);
                changed |= group.Add(link.Second);
            }
        } while (changed);
        return group;
    }
}
