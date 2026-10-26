using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoTuong.Infrastructure.Persistence.Migrations;

/// <summary>
/// Baseline marker only. The Phase 1 schema is provisioned by
/// database/01_schema_phase1.sql; migrations after this marker contain
/// incremental changes and must not recreate the existing application schema.
/// </summary>
public partial class Baseline : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) { }

    protected override void Down(MigrationBuilder migrationBuilder) { }
}
