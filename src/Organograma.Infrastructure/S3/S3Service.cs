using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Organograma.Application.Abstractions;
using Organograma.Application.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Organograma.Infrastructure.S3;

public sealed class S3Service : IS3Service
{
    private readonly IAmazonS3 _client;
    private readonly string _bucket;
    private readonly ILogger<S3Service> _logger;

    public S3Service(IOptions<AwsOptions> options, ILogger<S3Service> logger)
    {
        var o = options.Value;
        _bucket = string.IsNullOrWhiteSpace(o.BucketName) ? "system-organograma" : o.BucketName;
        _logger = logger;

        var config = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.GetBySystemName(
                string.IsNullOrWhiteSpace(o.Region) ? "us-east-2" : o.Region),
        };

        if (!string.IsNullOrWhiteSpace(o.AccessKeyId) && !string.IsNullOrWhiteSpace(o.SecretAccessKey))
        {
            _client = new AmazonS3Client(o.AccessKeyId, o.SecretAccessKey, config);
        }
        else
        {
            _client = new AmazonS3Client(config);
        }
    }

    public Task<string?> GerarUrlPreAssinadaAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _bucket,
                Key = key,
                Expires = DateTime.UtcNow.AddHours(1),
                Verb = HttpVerb.GET,
            };
            return Task.FromResult<string?>(_client.GetPreSignedURL(request));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar URL pré-assinada");
            return Task.FromResult<string?>(null);
        }
    }

    public async Task<string> UploadFileAsync(
        Stream content,
        string contentType,
        string folder,
        string? tenantId = null,
        CancellationToken ct = default)
    {
        var ext = contentType.Contains('/') ? contentType.Split('/')[1] : "bin";
        var fileName = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.{ext}";
        var tenantPrefix = tenantId is not null ? $"{tenantId}/" : "";
        var key = $"uploads/{tenantPrefix}{folder}/{fileName}";

        var put = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            CannedACL = S3CannedACL.Private,
        };
        await _client.PutObjectAsync(put, ct);
        return key;
    }
}

public sealed class NullS3Service : IS3Service
{
    public Task<string?> GerarUrlPreAssinadaAsync(string key, CancellationToken ct = default)
        => Task.FromResult<string?>(key);

    public Task<string> UploadFileAsync(
        Stream content,
        string contentType,
        string folder,
        string? tenantId = null,
        CancellationToken ct = default)
    {
        var ext = contentType.Contains('/') ? contentType.Split('/')[1] : "bin";
        var fileName = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.{ext}";
        var tenantPrefix = tenantId is not null ? $"{tenantId}/" : "";
        return Task.FromResult($"uploads/{tenantPrefix}{folder}/{fileName}");
    }
}
