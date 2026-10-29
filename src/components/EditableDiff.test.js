import React from "react";
import { act, render } from "@testing-library/react";
import { DiffEditor } from "@monaco-editor/react";
import { EditableDiff } from "./EditableDiff";

jest.mock("@monaco-editor/react", () => ({ DiffEditor: jest.fn(() => null) }));

const modelEditor = (initial) => {
  let value = initial;
  let listener;
  const dispose = jest.fn();
  return {
    dispose,
    getValue: () => value,
    onDidChangeModelContent: (callback) => { listener = callback; return { dispose }; },
    change: (next) => { value = next; listener(); },
  };
};

test("both sides are editable and user changes reach workspace state", () => {
  const onLeftChange = jest.fn();
  const onRightChange = jest.fn();
  const { unmount } = render(<EditableDiff left="{}" right="[]" onLeftChange={onLeftChange} onRightChange={onRightChange} />);
  const props = DiffEditor.mock.calls.at(-1)[0];
  expect(props.options).toMatchObject({ readOnly: false, originalEditable: true });
  const left = modelEditor("{}");
  const right = modelEditor("[]");
  act(() => props.onMount({ getOriginalEditor: () => left, getModifiedEditor: () => right }));
  act(() => left.change('{"id":1}'));
  act(() => right.change('[1]'));
  expect(onLeftChange).toHaveBeenCalledWith('{"id":1}');
  expect(onRightChange).toHaveBeenCalledWith('[1]');
  unmount();
  expect(left.dispose).toHaveBeenCalledTimes(1);
  expect(right.dispose).toHaveBeenCalledTimes(1);
});

test("controlled document switches do not fire edit callbacks and later edits use the latest callback", () => {
  const oldCallback = jest.fn();
  const newCallback = jest.fn();
  const { rerender } = render(<EditableDiff left="{}" right="[]" onLeftChange={() => {}} onRightChange={oldCallback} />);
  const left = modelEditor("{}");
  const right = modelEditor("[]");
  act(() => DiffEditor.mock.calls.at(-1)[0].onMount({ getOriginalEditor: () => left, getModifiedEditor: () => right }));
  rerender(<EditableDiff left="{}" right='{"saved":true}' onLeftChange={() => {}} onRightChange={newCallback} />);
  act(() => right.change('{"saved":true}'));
  expect(newCallback).not.toHaveBeenCalled();
  act(() => right.change('{"saved":false}'));
  expect(newCallback).toHaveBeenCalledWith('{"saved":false}');
  expect(oldCallback).not.toHaveBeenCalled();
});
