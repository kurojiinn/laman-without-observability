import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { OrdersPage } from "./OrdersPage";

vi.mock("../../features/sse/usePickerRealtime", () => ({
  usePickerRealtime: () => undefined,
}));

vi.mock("../../features/orders/hooks", () => ({
  usePickerOrders: () => ({
    isLoading: false,
    isError: false,
    data: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        guestName: "Тест",
        guestPhone: "79990000000",
        guestAddress: "Адрес",
        comment: null,
        status: "NEW",
        storeId: "22222222-2222-2222-2222-222222222222",
        paymentMethod: "CASH",
        itemsTotal: 100,
        serviceFee: 5,
        deliveryFee: 200,
        finalTotal: 305,
        createdAt: "2026-03-28T12:00:00Z",
        updatedAt: "2026-03-28T12:00:00Z",
      },
    ],
  }),
}));

vi.mock("../../features/auth/sessionStore", () => ({
  useSession: () => ({
    role: "PICKER",
    storeId: "22222222-2222-2222-2222-222222222222",
  }),
  logout: () => undefined,
}));

describe("OrdersPage", () => {
  it("renders order table", () => {
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Очередь заказов")).toBeInTheDocument();
    expect(screen.getByText("Тест")).toBeInTheDocument();
    expect(screen.getByText("Новый")).toBeInTheDocument();
  });
});
