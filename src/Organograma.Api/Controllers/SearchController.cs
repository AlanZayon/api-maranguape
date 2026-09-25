using Organograma.Api.Auth;
using Organograma.Application.Search;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/search")]
[AuthGuard]
public sealed class SearchController(SearchService searchService) : ControllerBase
{
    [HttpGet("autocomplete")]
    public async Task<IActionResult> Autocomplete([FromQuery] string? q, CancellationToken ct)
        => Ok(await searchService.AutocompleteAsync(q, HttpContext.GetTenantId(), ct));

    [HttpGet("search-funcionarios")]
    public async Task<IActionResult> SearchFuncionarios([FromQuery] string? q, CancellationToken ct)
        => Ok(await searchService.SearchFuncionariosAsync(q, HttpContext.GetTenantId(), ct));
}
