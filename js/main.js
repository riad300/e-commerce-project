import headerFunc from "./header.js";
import productFunc from "./product.js";
import searchFunc from "./search.js";

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

//! add product to localstorage start
(async function () {
  const products = await fetch("js/data.json");
  const data = await products.json();

  data ? localStorage.setItem("products", JSON.stringify(data)) : [];
  productFunc(data);
  searchFunc(data);
})();
//! add product to localstorage end

window.addEventListener("DOMContentLoaded", () => {
  // cart count
  const cartItem = document.querySelector(".header-cart-count");
  if (cartItem) {
    cartItem.innerHTML = localStorage.getItem("cart")
      ? JSON.parse(localStorage.getItem("cart")).length
      : "0";
  }

  // modal dialog
  const modal = document.querySelector(".modal-dialog");
  const modalContent = document.querySelector(".modal-dialog .modal-content");
  const btnModalClose = document.querySelector(".modal-dialog .modal-close");

  if (btnModalClose) {
    btnModalClose.addEventListener("click", () => modal.classList.remove("show"));
  }

  //if (modal) {
  //  document.addEventListener("click", (e) => {
    //  if (!e.composedPath().includes(modalContent)) modal.classList.remove("show");
    //});

    //setTimeout(() => modal.classList.add("show"), 3000);
  //}

  // ✅ Profile icon link update (NO REDIRECT)
  const accountLink = document.getElementById("accountLink");
  onAuthStateChanged(auth, (user) => {
    if (!accountLink) return;
    accountLink.href = user ? "profile.html" : "account.html";
    accountLink.style.display = "inline-flex"; // icon hide থাকলে force show
  });
});
