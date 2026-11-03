export function confirmDialog(message, title = "Bevestigen") {
  const dialog = document.querySelector("#confirm-dialog");
  dialog.querySelector("#confirm-title").textContent = title;
  dialog.querySelector("#confirm-message").textContent = message;
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
  });
}

export function promptDialog(message, value = "", title = "Gegevens invullen") {
  const dialog = document.querySelector("#prompt-dialog");
  dialog.querySelector("#prompt-title").textContent = title;
  dialog.querySelector("#prompt-message").textContent = message;
  const input = dialog.querySelector("input");
  input.value = value;
  const form = dialog.querySelector("form");
  const submit = event => {
    event.preventDefault();
    dialog.close("confirm");
  };
  const cleanup = () => form.removeEventListener("submit", submit);
  form.addEventListener("submit", submit);
  dialog.addEventListener("close", cleanup, { once: true });
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm" ? input.value : null), { once: true });
  });
}
