/**
 * Catalog table — column-alignment rendering test (the column-bug standard).
 * A known part's fields must land under their OWN headers: the Nth direct <td>
 * of the row aligns with the Nth <th>. Checks direct-child <td>s (not nested),
 * so a collapsed/misaligned cell fails the count + per-column value checks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CatalogPage } from "@/lib/api";

vi.mock("@/lib/api", () => ({ fetchCatalog: vi.fn() }));

import Catalog from "@/pages/Catalog";
import { fetchCatalog } from "@/lib/api";

const PAGE: CatalogPage = {
  items: [
    {
      sku: "344-STM32F407VGT6",
      mpn: "STM32F407VGT6",
      manufacturer: "STMicroelectronics",
      description: "ARM Cortex-M4 MCU 1MB Flash 168MHz LQFP-100",
      package: "LQFP-100",
      lifecycle: "Active",
      price: { amount: 9.883, currency: "USD" },
      stock: 18266,
    },
  ],
  total: 1,
  page: 1,
  limit: 25,
};

function renderCatalog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Catalog />
    </QueryClientProvider>
  );
}

describe("Catalog table column alignment", () => {
  beforeEach(() => vi.mocked(fetchCatalog).mockResolvedValue(PAGE));

  it("renders each field under its OWN column header", async () => {
    const { container } = renderCatalog();
    await waitFor(() => expect(screen.getByText("STM32F407VGT6")).toBeInTheDocument());

    const headers = Array.from(
      container.querySelectorAll("table thead tr > th")
    ).map((th) => (th.textContent ?? "").trim());

    const dataTr = screen.getByText("STM32F407VGT6").closest("tr")!;
    const cells = Array.from(dataTr.querySelectorAll(":scope > td"));
    expect(cells.length).toBe(headers.length); // catches a collapsed/missing cell

    const cellUnder = (label: string) => {
      const idx = headers.indexOf(label);
      expect(idx, `header "${label}" must exist`).toBeGreaterThanOrEqual(0);
      return (cells[idx].textContent ?? "").trim();
    };

    expect(cellUnder("MPN")).toBe("STM32F407VGT6");
    expect(cellUnder("Manufacturer")).toBe("STMicroelectronics");
    expect(cellUnder("Description")).toContain("ARM Cortex-M4");
    expect(cellUnder("Package")).toBe("LQFP-100");
    expect(cellUnder("Price")).toContain("$9.88");
    expect(cellUnder("Stock")).toContain("18,266");
    expect(cellUnder("Lifecycle")).toContain("Active");
  });

  it("shows the part count and page indicator", async () => {
    renderCatalog();
    await waitFor(() => expect(screen.getByText("STM32F407VGT6")).toBeInTheDocument());
    expect(screen.getByText(/1 parts/i)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 1/i)).toBeInTheDocument();
  });
});
