namespace Organograma.Domain;

public sealed class AppException : Exception
{
    public int StatusCode { get; }
    public string Code { get; }
    public bool IsOperational { get; }

    public AppException(
        string message,
        int statusCode = 400,
        string code = "APP_ERROR",
        bool isOperational = true)
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
        IsOperational = isOperational;
    }
}
