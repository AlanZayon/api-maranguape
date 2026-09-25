namespace Organograma.Application.Options;

public sealed class MongoOptions
{
    public const string SectionName = "Mongo";
    public string ConnectionString { get; set; } = "mongodb://localhost:27017/funcionarios";
    public string DatabaseName { get; set; } = "funcionarios";
}

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Secret { get; set; } = "";
    public string ExpiresIn { get; set; } = "24h";
}

public sealed class RedisOptions
{
    public const string SectionName = "Redis";
    public string Url { get; set; } = "redis://localhost:6379";
}

public sealed class AwsOptions
{
    public const string SectionName = "Aws";
    public string AccessKeyId { get; set; } = "";
    public string SecretAccessKey { get; set; } = "";
    public string Region { get; set; } = "us-east-2";
    public string BucketName { get; set; } = "system-organograma";
}

public sealed class CorsAppOptions
{
    public const string SectionName = "Cors";
    public string BaseDomain { get; set; } = "";
    public string Origins { get; set; } = "";
}

public sealed class BrandingPolicyOptions
{
    public const string SectionName = "BrandingPolicy";
    public bool CustomCssEnabled { get; set; } = true;
    public int CustomCssMaxLength { get; set; } = 20000;
    public string EditableFields { get; set; } =
        "logoUrl,faviconUrl,displayName,primaryColor,secondaryColor,primaryContrast,headerBg,headerText,sidebarBg,sidebarText,surfaceBg,pageBg,textColor,mutedColor,borderColor,fontFamily,fontUrl,themeMode,customCss";
    public string AllowedSelectors { get; set; } =
        ".login-page,.login-card,.sidebar,.app-header,.app-shell,.btn-brand,.dashboard-page,.dashboard-stat,.relatorio-preview,.relatorio-document";
    public string FontUrlHosts { get; set; } = "fonts.googleapis.com,fonts.gstatic.com";
    public int BrandingAssetMaxBytes { get; set; } = 2097152;
}

public sealed class AppHostOptions
{
    public const string SectionName = "App";
    public string NodeEnv { get; set; } = "development";
    public int Port { get; set; } = 3000;
    public int RateLimitMax { get; set; } = 100;
}
