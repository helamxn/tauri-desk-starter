import { blockContextMenu, isEditable } from "./context-menu";

const openMenu = (target: Element) => {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("browser context menu", () => {
  let unlisten: () => void;
  beforeEach(() => {
    unlisten = blockContextMenu();
  });
  afterEach(() => {
    unlisten();
    document.body.innerHTML = "";
  });

  it("blocks menus outside editable fields", () => {
    const p = document.body.appendChild(document.createElement("p"));
    expect(openMenu(p)).toBe(true);
  });

  it("allows the menu in editable text fields", () => {
    const input = document.body.appendChild(document.createElement("input"));
    const textarea = document.body.appendChild(document.createElement("textarea"));
    const editable = document.body.appendChild(document.createElement("div"));
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true }); // jsdom no lo calcula
    expect(openMenu(input)).toBe(false);
    expect(openMenu(textarea)).toBe(false);
    expect(openMenu(editable)).toBe(false);
  });

  it("blocks non-text, disabled and read-only fields", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const disabled = document.createElement("input");
    disabled.disabled = true;
    const readOnlyField = document.createElement("textarea");
    readOnlyField.readOnly = true;
    expect(isEditable(checkbox)).toBe(false);
    expect(isEditable(disabled)).toBe(false);
    expect(isEditable(readOnlyField)).toBe(false);
  });

  it("restores the default menu on cleanup", () => {
    unlisten();
    const p = document.body.appendChild(document.createElement("p"));
    expect(openMenu(p)).toBe(false);
    unlisten = blockContextMenu();
  });
});
