// Pure, dependency-free helpers shared across modules.

export function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

export function getCookie(name) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
}

export function parseColorToRGBA(c) {
    if (!c) return [150, 150, 150, 1.0];
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    // data is [R, G, B, A] where A is 0-255
    return [data[0], data[1], data[2], data[3] / 255];
}

export function deepClone(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
}
