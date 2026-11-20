import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

const signInWithPassword = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  tryCreateClient: () => ({ auth: { signInWithPassword } }),
  createClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

describe("LoginForm", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    replace.mockReset();
    refresh.mockReset();
  });

  it("shows validation errors and does not call Supabase on empty submit", async () => {
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);

    await user.click(screen.getByRole("button", { name: "Accedi" }));

    expect(await screen.findByText("Inserisci la tua email")).toBeInTheDocument();
    expect(screen.getByText("Inserisci la password")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows a generic message on invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);

    await user.type(screen.getByLabelText("Email"), "Mario@Example.com");
    await user.type(screen.getByLabelText("Password"), "whatever");
    await user.click(screen.getByRole("button", { name: "Accedi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o password non corretti.");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "mario@example.com", password: "whatever" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to a sanitised path after login", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm next="//evil.example" />);

    await user.type(screen.getByLabelText("Email"), "mario@example.com");
    await user.type(screen.getByLabelText("Password"), "whatever");
    await user.click(screen.getByRole("button", { name: "Accedi" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });
});
