import { act, renderHook } from "@testing-library/react";
import { useClipboard } from "./useClipboard";

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
});
afterEach(() => { jest.useRealTimers(); });

test("shows specific success feedback only after copying and dismisses it", async () => {
  const { result } = renderHook(useClipboard);
  await act(async () => { await result.current.copyText("profile.name", "path"); });
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith("profile.name");
  expect(result.current.notification.message).toBe("Path copied to clipboard");
  expect(result.current.copied).toBe("path");
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current.notification).toBeNull();
  expect(result.current.copied).toBe("");
});

test("repeated copies restart the feedback timer", async () => {
  const { result } = renderHook(useClipboard);
  await act(async () => { await result.current.copyText("name", "key"); });
  act(() => jest.advanceTimersByTime(2000));
  await act(async () => { await result.current.copyText("Ada", "value"); });
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current.notification.message).toBe("Value copied to clipboard");
  act(() => result.current.dismiss());
  expect(result.current.notification).toBeNull();
});

test("reports clipboard failures without claiming success", async () => {
  navigator.clipboard.writeText.mockRejectedValue(new Error("blocked"));
  const { result } = renderHook(useClipboard);
  await act(async () => { await result.current.copyText("secret", "value"); });
  expect(result.current.notification.tone).toBe("error");
  expect(result.current.notification.message).not.toContain("secret");
  expect(result.current.copied).toBe("");
  act(() => jest.advanceTimersByTime(5000));
  expect(result.current.notification).toBeNull();
});

test("an older clipboard request cannot replace newer feedback", async () => {
  let finishFirst;
  navigator.clipboard.writeText.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
  const { result } = renderHook(useClipboard);
  let first;
  act(() => { first = result.current.copyText("name", "key"); });
  await act(async () => { await result.current.copyText("Ada", "value"); });
  await act(async () => { finishFirst(); await first; });
  expect(result.current.notification.message).toBe("Value copied to clipboard");
});
