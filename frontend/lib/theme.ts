export const THEME_STORAGE_KEY = "theme"

/** Runs before paint (inlined in <head>) so the saved theme never flashes. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`
