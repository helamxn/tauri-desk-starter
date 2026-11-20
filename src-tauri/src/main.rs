// El ejecutable de distribución abre solo la ventana de la app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run()
}
