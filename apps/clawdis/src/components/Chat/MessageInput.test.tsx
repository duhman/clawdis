import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageInput } from "./MessageInput";
import { useGatewayStore } from "../../stores/gateway";

describe("MessageInput", () => {
  beforeEach(() => {
    // Reset store to default state
    useGatewayStore.setState({
      status: "connected",
      isGenerating: false,
    });
  });

  it("should render input and button", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("should call onSend when form is submitted", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(input.closest("form")!);

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("should clear input after sending", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(input.closest("form")!);

    expect(input.value).toBe("");
  });

  it("should be disabled when disconnected", () => {
    useGatewayStore.setState({ status: "disconnected" });

    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByRole("textbox");
    const button = screen.getByRole("button", { name: "Send" });

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
  });

  it("should show Stop button when generating", () => {
    useGatewayStore.setState({ status: "connected", isGenerating: true });

    const onSend = vi.fn();
    const onAbort = vi.fn();
    render(<MessageInput onSend={onSend} onAbort={onAbort} />);

    const input = screen.getByRole("textbox");
    const stopButton = screen.getByRole("button", { name: "Stop" });

    expect(input).toBeDisabled();
    expect(stopButton).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send" }),
    ).not.toBeInTheDocument();
  });

  it("should call onAbort when Stop button is clicked", () => {
    useGatewayStore.setState({ status: "connected", isGenerating: true });

    const onSend = vi.fn();
    const onAbort = vi.fn();
    render(<MessageInput onSend={onSend} onAbort={onAbort} />);

    const stopButton = screen.getByRole("button", { name: "Stop" });
    fireEvent.click(stopButton);

    expect(onAbort).toHaveBeenCalled();
  });

  it("should not send empty messages", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should trim message before sending", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  Hello World  " } });
    fireEvent.submit(input.closest("form")!);

    expect(onSend).toHaveBeenCalledWith("Hello World");
  });
});
