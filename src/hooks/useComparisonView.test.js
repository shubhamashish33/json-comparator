import { act, renderHook } from "@testing-library/react";
import { useComparisonView } from "./useComparisonView";

const options = () => ({ setMode: jest.fn(), parsing: false, busy: false, complete: false, runCompare: jest.fn() });

test("selecting Tree compares automatically, selecting Text does not", () => {
  const props = options();
  const { result } = renderHook(() => useComparisonView(props));
  act(() => result.current("text"));
  expect(props.runCompare).not.toHaveBeenCalled();
  act(() => result.current("tree"));
  expect(props.setMode).toHaveBeenLastCalledWith("tree");
  expect(props.runCompare).toHaveBeenCalledTimes(1);
});

test("Tree waits for parsing and compares the latest inputs once", () => {
  const props = options();
  const { result, rerender } = renderHook((value) => useComparisonView(value), { initialProps: { ...props, parsing: true } });
  act(() => result.current("tree"));
  expect(props.runCompare).not.toHaveBeenCalled();
  const latestCompare = jest.fn();
  rerender({ ...props, runCompare: latestCompare });
  expect(latestCompare).toHaveBeenCalledTimes(1);
  rerender({ ...props, runCompare: latestCompare });
  expect(latestCompare).toHaveBeenCalledTimes(1);
});

test.each([{ busy: true }, { complete: true }])("does not duplicate an active or completed comparison: %j", (state) => {
  const props = { ...options(), ...state };
  const { result } = renderHook(() => useComparisonView(props));
  act(() => result.current("tree"));
  expect(props.runCompare).not.toHaveBeenCalled();
});

test("switching back to Text cancels a comparison waiting for parsing", () => {
  const props = options();
  const { result, rerender } = renderHook((value) => useComparisonView(value), { initialProps: { ...props, parsing: true } });
  act(() => result.current("tree"));
  act(() => result.current("text"));
  rerender(props);
  expect(props.runCompare).not.toHaveBeenCalled();
});
