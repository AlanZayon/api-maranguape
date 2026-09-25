using System.Net;
using System.Text.Json;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Organograma.Api.Filters;

public sealed class AppExceptionFilter : IExceptionFilter
{
    private readonly ILogger<AppExceptionFilter> _logger;
    private readonly IHostEnvironment _env;

    public AppExceptionFilter(ILogger<AppExceptionFilter> logger, IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public void OnException(ExceptionContext context)
    {
        if (context.Exception is AppException app)
        {
            if (!app.IsOperational || app.StatusCode >= 500)
                _logger.LogError(app, "{Message}", app.Message);

            context.Result = new JsonResult(new
            {
                error = true,
                code = app.Code,
                message = app.Message,
            })
            {
                StatusCode = app.StatusCode,
            };
            context.ExceptionHandled = true;
            return;
        }

        if (context.Exception is BadHttpRequestException bad)
        {
            context.Result = new JsonResult(new
            {
                error = true,
                code = "HTTP_ERROR",
                message = bad.Message,
            })
            {
                StatusCode = bad.StatusCode,
            };
            context.ExceptionHandled = true;
            return;
        }

        _logger.LogError(context.Exception, "Unhandled error at {Path}", context.HttpContext.Request.Path);

        object body = _env.IsProduction()
            ? new { error = true, code = "INTERNAL_ERROR", message = "Erro interno do servidor" }
            : new
            {
                error = true,
                code = "INTERNAL_ERROR",
                message = "Erro interno do servidor",
                details = context.Exception.Message,
            };

        context.Result = new JsonResult(body)
        {
            StatusCode = (int)HttpStatusCode.InternalServerError,
        };
        context.ExceptionHandled = true;
    }
}

public sealed class AppExceptionFilterAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        // Prefer DI-registered filter via Program.cs
        base.OnException(context);
    }
}
