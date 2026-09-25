# Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Organograma.slnx ./
COPY src/Organograma.Api/Organograma.Api.csproj src/Organograma.Api/
COPY src/Organograma.Application/Organograma.Application.csproj src/Organograma.Application/
COPY src/Organograma.Domain/Organograma.Domain.csproj src/Organograma.Domain/
COPY src/Organograma.Infrastructure/Organograma.Infrastructure.csproj src/Organograma.Infrastructure/
COPY tests/Organograma.UnitTests/Organograma.UnitTests.csproj tests/Organograma.UnitTests/
COPY tests/Organograma.IntegrationTests/Organograma.IntegrationTests.csproj tests/Organograma.IntegrationTests/

RUN dotnet restore Organograma.slnx

COPY src/ src/
COPY tests/ tests/

RUN dotnet publish src/Organograma.Api/Organograma.Api.csproj -c Release -o /app/publish --no-restore

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:3000
ENV PORT=3000
EXPOSE 3000
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Organograma.Api.dll"]
