using System.Text;
using System.Threading.RateLimiting;
using Hangfire;
using Organograma.Api.Cors;
using Organograma.Api.Filters;
using Organograma.Api.Middleware;
using Organograma.Application;
using Organograma.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

builder.Services.AddApplication(builder.Configuration);
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddSingleton<MetricsCollector>();
builder.Services.AddControllers(options =>
{
    options.Filters.Add<AppExceptionFilter>();
});
builder.Services.AddAppCors(builder.Configuration);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var secret = builder.Configuration["JWT_SECRET"]
                     ?? builder.Configuration["Jwt:Secret"]
                     ?? "dev_jwt_secret_change_me";
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (ctx.Request.Cookies.TryGetValue("authToken", out var token))
                    ctx.Token = token;
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization();

var rateLimitMax = 100;
if (int.TryParse(builder.Configuration["RATE_LIMIT_MAX"], out var parsedRate))
    rateLimitMax = parsedRate;

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = rateLimitMax,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

builder.Services.AddOpenApi();

var app = builder.Build();

// WebApplicationFactory / TestServer owns URLs; binding Kestrel breaks hosting under test.
if (!app.Environment.IsEnvironment("Testing"))
{
    var port = builder.Configuration["PORT"] ?? "3000";
    app.Urls.Clear();
    app.Urls.Add($"http://0.0.0.0:{port}");
}

app.MapOpenApi();

app.UseCors("AppCors");
app.UseRateLimiter();
app.UseMiddleware<MetricsMiddleware>();
app.UseMiddleware<TenantMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

try
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = [new HangfireAllowAllFilter()],
    });
}
catch
{
    // Hangfire may not be registered if Mongo URL was invalid
}

app.MapControllers();

app.Run();

internal sealed class HangfireAllowAllFilter : Hangfire.Dashboard.IDashboardAuthorizationFilter
{
    public bool Authorize(Hangfire.Dashboard.DashboardContext context) => true;
}

public partial class Program;
