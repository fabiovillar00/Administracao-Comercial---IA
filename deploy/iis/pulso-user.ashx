<%@ WebHandler Language="C#" Class="PulsoUserHandler" %>

using System;
using System.Web;
using System.Text.RegularExpressions;

public class PulsoUserHandler : IHttpHandler
{
    public bool IsReusable { get { return false; } }

    public void ProcessRequest(HttpContext context)
    {
        context.Response.ContentType = "application/json";
        context.Response.ContentEncoding = System.Text.Encoding.UTF8;
        context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        context.Response.Cache.SetNoStore();
        context.Response.Cache.SetExpires(DateTime.UtcNow.AddDays(-1));
        context.Response.TrySkipIisCustomErrors = true;

        // Read the request token issued by IIS, never the worker process account
        // and never a username supplied in a header, cookie or query string.
        var identity = context.Request.LogonUserIdentity;
        if (identity == null || !identity.IsAuthenticated ||
            String.IsNullOrWhiteSpace(identity.Name))
        {
            context.Response.StatusCode = 401;
            context.Response.Write("{\"authenticated\":false,\"login\":null,\"name\":null,\"initials\":null}");
            return;
        }

        string login = identity.Name;
        string name = login.Substring(login.LastIndexOf('\\') + 1).Split('@')[0];
        string[] parts = Regex.Split(name, @"[.\s_-]+");
        parts = Array.FindAll(parts, part => part.Length > 0);
        string initials = parts.Length > 1
            ? parts[0].Substring(0, 1) + parts[parts.Length - 1].Substring(0, 1)
            : name.Substring(0, Math.Min(2, name.Length));
        context.Response.Write("{\"authenticated\":true,\"login\":" + Quote(login) +
            ",\"name\":" + Quote(name) + ",\"initials\":" + Quote(initials.ToUpperInvariant()) + "}");
    }

    private static string Quote(string value)
    {
        return HttpUtility.JavaScriptStringEncode(value, true);
    }
}
