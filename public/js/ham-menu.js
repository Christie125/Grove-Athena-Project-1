document.addEventListener('DOMContentLoaded', () => {
    const hamMenu = document.querySelector(".menu-icon");
    const close = document.querySelector(".close-icon");
    const offScreenMenu = document.querySelector(".off-screen-menu");
      
    hamMenu.addEventListener("click", () => {
        offScreenMenu.classList.toggle("active");
    });
  
    close.addEventListener("click", () => {
        offScreenMenu.classList.remove("active");
        console.log("Menu closed.");
    });
});
  