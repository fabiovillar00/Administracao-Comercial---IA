<%@ WebHandler Language="C#" Class="PulsoUserHandler" %>

using System;
using System.Web;
using System.Text.RegularExpressions;
using System.IO;
using System.Text;
using System.Security.Cryptography;

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
        bool usageReady = false;
        // The signing key lives outside the web root, provisioned by an administrator.
        try {
            string root = Directory.GetParent(context.Server.MapPath("~/").TrimEnd('\\', '/')).FullName;
            byte[] key = File.ReadAllBytes(Path.Combine(root, "Config", "Usage", "identity.key"));
            if (key.Length == 32 && context.Request.IsSecureConnection) {
                long expires = (long)(DateTime.UtcNow.AddMinutes(5) - new DateTime(1970, 1, 1)).TotalSeconds;
                string message = "v1." + B64(Encoding.UTF8.GetBytes(login)) + "." + expires;
                using (var mac = new HMACSHA256(key)) {
                    var cookie = new HttpCookie("PulsoUsageIdentity", message + "." + B64(mac.ComputeHash(Encoding.ASCII.GetBytes(message))));
                    cookie.HttpOnly = true;
                    cookie.Secure = true;
                    cookie.Path = "/";
                    cookie.SameSite = SameSiteMode.Strict;
                    cookie.Expires = DateTime.UtcNow.AddMinutes(5);
                    context.Response.Cookies.Add(cookie);
                    usageReady = true;
                }
            }
        } catch (IOException) { } catch (UnauthorizedAccessException) { }
        string name = login.Substring(login.LastIndexOf('\\') + 1).Split('@')[0];
        string[] parts = Regex.Split(name, @"[.\s_-]+");
        parts = Array.FindAll(parts, part => part.Length > 0);
        string initials = parts.Length > 1
            ? parts[0].Substring(0, 1) + parts[parts.Length - 1].Substring(0, 1)
            : name.Substring(0, Math.Min(2, name.Length));
        context.Response.Write("{\"authenticated\":true,\"login\":" + Quote(login) +
            ",\"name\":" + Quote(name) + ",\"initials\":" + Quote(initials.ToUpperInvariant()) +
            ",\"usageReady\":" + (usageReady ? "true" : "false") +
            ",\"canManageUsage\":" + (usageReady && String.Equals(login, @"DMB\fabio.andrade", StringComparison.OrdinalIgnoreCase) ? "true" : "false") + "}");
    }

    private static string Quote(string value)
    {
        return HttpUtility.JavaScriptStringEncode(value, true);
    }

    private static string B64(byte[] value) {
        return Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
