export function confirmDialog(message, title = "Even checken") {
  const dialog = document.querySelector("#confirm-dialog");
  const form = dialog.querySelector("form");
  const cancelButton = form.querySelector('button[value="cancel"]');
  const confirmButton = form.querySelector('button[value="confirm"]');
  dialog.querySelector("#confirm-title").textContent = title;
  dialog.querySelector("#confirm-message").textContent = message;
  cancelButton.type = "button";
  confirmButton.autofocus = true;
  const cancel = () => dialog.close("cancel");
  const confirmOnEnter = (event) => {
    if (event.key !== "Enter" || event.target === cancelButton) return;
    event.preventDefault();
    dialog.close("confirm");
  };
  const cleanup = () => {
    cancelButton.removeEventListener("click", cancel);
    dialog.removeEventListener("keydown", confirmOnEnter);
    confirmButton.autofocus = false;
  };
  cancelButton.addEventListener("click", cancel);
  dialog.addEventListener("keydown", confirmOnEnter);
  dialog.addEventListener("close", cleanup, { once: true });
  dialog.showModal();
  confirmButton.focus();
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    );
  });
}

export function promptDialog(
  message,
  value = "",
  title = "Even invullen",
  placeholder = "",
) {
  const dialog = document.querySelector("#prompt-dialog");
  dialog.querySelector("#prompt-title").textContent = title;
  dialog.querySelector("#prompt-message").textContent = message;
  const input = dialog.querySelector("input");
  input.value = value;
  input.placeholder = placeholder;
  dialog.returnValue = "";
  const form = dialog.querySelector("form");
  const cancelButton = form.querySelector('button[value="cancel"]');
  cancelButton.type = "button";
  const submit = (event) => {
    if (event.submitter?.value !== "confirm") return;
    event.preventDefault();
    dialog.close("confirm");
  };
  const cancel = (event) => {
    dialog.close("cancel");
  };
  const cleanup = () => {
    form.removeEventListener("submit", submit);
    cancelButton.removeEventListener("click", cancel);
  };
  form.addEventListener("submit", submit);
  cancelButton.addEventListener("click", cancel);
  dialog.addEventListener("close", cleanup, { once: true });
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm" ? input.value : null),
      { once: true },
    );
  });
}
