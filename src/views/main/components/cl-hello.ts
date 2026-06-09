export class ClHello extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute("name") ?? "world";
    this.innerHTML = `<p>Hello, ${name}!</p>`;
  }
}

if (!customElements.get("cl-hello")) {
  customElements.define("cl-hello", ClHello);
}
