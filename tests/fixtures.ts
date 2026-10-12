// Decoder fixtures: tiny files and the RGBA each decodes to. Generated
// 2026-10-12 with Pillow 12.3 (libjpeg-turbo) and ffmpeg. Truth: PNG exact
// (written from known samples); GIF exact (Pillow's decode, transparent
// pixels as zeros); JPEG ffmpeg's decoded planes with chroma replicated
// (what the decoder does), greyscale Pillow's decode, Adobe CMYK its
// channels multiplied out; `tolerance` covers IDCT rounding. WebP exact
// (Pillow's decode, which is libwebp's).

export type Fixture = {
  name: string;
  file: string;
  width: number;
  height: number;
  rgba: string;
  tolerance: number;
};

export const FIXTURES: Fixture[] = [
  {
    name: "png: RGBA, interlaced",
    file: "iVBORw0KGgoAAAANSUhEUgAAAAcAAAAFCAYAAAH+ncZOAAAAg0lEQVR42m3KrxGDMBhA8ccfW1fVBcgAldmAOw7PAlRWcBddkyUQMd3g2yAVSFYgEpUN0q++4qfeAyhVAF+TKSHvvhkhbnC25FnzrhxldPcY3OyzW/vKwKHb56fG3fQY1IvmKt3T2CkZu6QWSzFc0j8gGqU7Rhmik+UdZPWbxEeWs/8CYcs1eGEbchsAAAAASUVORK5CYII=",
    width: 7,
    height: 5,
    rgba: "AAAA/ygAAOFQAADDeAAApaAAAIfIAABp8AAASwA8AP8oPA3hUDwaw3g8J6WgPDSHyDxBafA8TksAeAD/KHga4VB4NMN4eE6loHhoh8h4gmnweJxLALQA/yi0J+FQtE7DeLR1paC0nIfItMNp8LTqSwDwAP8o8DThUPBow3jwnKWg8NCHyPAEafDwOEs=",
    tolerance: 0,
  },
  {
    name: "png: 2-bit palette, tRNS",
    file: "iVBORw0KGgoAAAANSUhEUgAAAAkAAAAEAgMAAAAhYf1dAAAADFBMVEX6CgoK+goKCvrw8ACSo3uVAAAAA3RSTlP/gAB/bWh4AAAAGElEQVR4nGOQlmZgzGG4wuTq6sCcxy0LABWdAt1Az3gLAAAAAElFTkSuQmCC",
    width: 9,
    height: 4,
    rgba: "+goK/wr6CoAKCvoA8PAA//oKCv8K+gqACgr6APDwAP/6Cgr/CvoKgAoK+gDw8AD/+goK/wr6CoAKCvoA8PAA//oKCv8K+gqACgr6APDwAP/6Cgr/CvoKgAoK+gDw8AD/+goK/wr6CoAKCvoA8PAA//oKCv8K+gqACgr6APDwAP/6Cgr/CvoKgAoK+gDw8AD/",
    tolerance: 0,
  },
  {
    name: "png: 16-bit grey, tRNS key",
    file: "iVBORw0KGgoAAAANSUhEUgAAAAUAAAADEAAAAAAuzUZnAAAAAnRSTlMSNC/TSV4AAAAqSURBVHicYxAyMTqROkHI5LQCo3SE8YkjIgtrjE8wSUccEenikYnQ2QMAsqELBeMJF2sAAAAASUVORK5CYII=",
    width: 5,
    height: 3,
    rgba: "EhISADIyMv9lZWX/EhISAMvLy/8bGxv/Tk5O/xISEgCzs7P/5ubm/zY2Nv8SEhIAnJyc/8/Pz/8SEhIA",
    tolerance: 0,
  },
  {
    name: "png: RGB, stored blocks",
    file: "iVBORw0KGgoAAAANSUhEUgAAAAYAAAAECAIAAAAiZtkUAAAAV0lEQVR4AQFMALP/AAAAyCgAyFAAyHgAyKAAyMgAyAEAPMgoAAAoAAAoAAAoAAAoAAACADwAADwAADwAADwAADwAADwAAwB4ZBQeABQeABQeABQeABQeAGR8DBktpeO6AAAAAElFTkSuQmCC",
    width: 6,
    height: 4,
    rgba: "AADI/ygAyP9QAMj/eADI/6AAyP/IAMj/ADzI/yg8yP9QPMj/eDzI/6A8yP/IPMj/AHjI/yh4yP9QeMj/eHjI/6B4yP/IeMj/ALTI/yi0yP9QtMj/eLTI/6C0yP/ItMj/",
    tolerance: 0,
  },
  {
    name: "jpeg: baseline 4:2:0",
    file: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAANABUDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0rSWsPD2jxXt2CxklS3hiUfNJK5wiDtye5wK4bxB8adat/ibo+i6bYTajpTNKbufR4VurdIlyu9pG2hwHWRXZWVYyhG6Rg0a994Vu1vrB7O5hS4tpV2vHIMhh9KS4+GUUd9DHY6lPY6fI4ee2WNJGkQLjyRI4JETA/NHyDtGMAsG+lxlHOK2Eg8iqQjJbqS3u9+bXRL7Kjd9+j++xdDMq9Ch/Z1vZ3jzJScJaPXVb36a2vZSi02yxrumw3MsM6KFWVA+PTNFM8R3zR3aRooVEXaoB6AUV2Yl0fbSsup6WJdBVpKS16+p//9k=",
    width: 21,
    height: 13,
    rgba: "jnmI/5N+jf+nhKL/p4Si/8J3uP/NgsP/1H/U/9aB1v/zf+D/8n7f//p86P//ge3/9If//++C///zhu//6Xzl/+l82f/hdNH/wH+1/7x7sf+jgp3/l4KR/5iDkv+mg6H/rImn/8l+v//MgcL/14LX/+OO4//yft//94Pk//+L9//6fOj/6Xz5/++C///zhu//9Yjx//GE4f/oe9j/xYS6/79+tP+nhqH/lnab/6GBpv/Pd6r/13+y/+F/1v/lg9r/9n75//R89//vhfP/9437/7Gb7v+git3/FoKM/wVxe/+ekNv/sqTv//SK7//tg+j/1YXK/8x8wf+5ga7/poar/6CApf/KcqX/24O2/+WD2v/ph97//ob///qC/f/tg/H/4njm/4x2yf9nUaT/LZmj/y2Zo/9lV6L/mIrV//CG6//xh+z/24vQ/89/xP+7g7D/pnSl/7aEtf/giLv/4Ym8//Zu9v//ef//zZz4/7iH4/+gho//eF5n/1JmHv+4zIT/MhEA/z0cAP/NwZf/vrKI/+N97f/th/f/6Yng/9x80//OfLz/q3mq/7SCs//ZgbT/3oa5//+A////g///r37a/49euv+3nab/uqCp/5uvZ/8oPAD/QB8A/z0cAP8vIwD/gnZM/9p05P/th/f/7Izj/95+1f/SgMD/rICz/62BtP/jeMr/9Inb/8ah/v+RbMn/Xmk+/5+qf//f00P/zcEx/wtJAP8sahf/AGQA/wBJAP+aTQD/14oe/89w5P/mh/v/8ovn/+R92f/efMf/qX2w/7aKvf/lesz/6n/R/8ah/v+KZcL/Tlku/6u2i/+QhAD/NioA/6HfjP8lYxD/JYoA/2LHO///s0f/wHMH/85v4//mh/v/8Yrm/+J71//efMf/rH6j/7WHrP/bf8D/44fI//6F+P/7gvX/l4XP/3Jgqv8xeqP/W6TN/3GhVf9djUH/JsIA/0zoGv/G1kD/ZHQA/9B04//lifj/8Izk/+F91f/XesD/rH6j/7OFqv/Xe7z/3YHC//h/8v//h/r/sqDq/6GP2f9Ikbr/MHmi/0FxJf+by3//Yf0v/zvXCf9rewD/ssIs/9p+7f/ni/r/7Ynh/9560v/Web//oHun/6iDr/+7hbb/woy9//B93P/6h+b//3/3//9+9v/igu3/2nrl/216rv9GU4f/wKKX/0EjGP9aSY//jXzC/+uJ8P/ti/L/4YnV/9V9yf/JgLf/nXik/6R/q/+4grP/voi5/+l21f/ue9r//3Xt//958f/ri/b/5ITv/6Sx5f+LmMz/akxB/5V3bP+fjtT/uKft/+2L8v/ohu3/2oLO/9F5xf/FfLP/o3ud/6V9n/+xfLT/toG5/9h2yf/efM//5oTR/+uJ1v//ffv//3r4/+x6///6iP//33j//+R9///3h+v/94fr//GD5v/qfN//0IHC/8l6u/+ygKb/",
    tolerance: 3,
  },
  {
    name: "jpeg: progressive 4:2:0",
    file: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wgARCAANABUDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAUCAwb/xAAWAQEBAQAAAAAAAAAAAAAAAAAFAwT/2gAMAwEAAhADEAAAAdKifiT9hEtp/8QAGhAAAgMBAQAAAAAAAAAAAAAAAgMBBAUSEf/aAAgBAQABBQJXFdNjacOm9cFNUuwLMiDsH4X/xAAeEQABAwQDAAAAAAAAAAAAAAABAAIRAxIh8AQUMv/aAAgBAwEBPwGqzkvYzr+cTmDukKpZeZX/xAAeEQABBAEFAAAAAAAAAAAAAAABAAIDEgQRFGHB0f/aAAgBAgEBPwGZmY+IbFwB5960UlLlf//EACAQAAEEAQUBAQAAAAAAAAAAAAEAAgMREjFBUWFxIZH/2gAIAQEABj8CD3bnEDkqGGNhki+5GEZNr39870QPKwcMmnYoBkhZGdW1d9Xx0qX/xAAbEAEBAAMBAQEAAAAAAAAAAAABEQAhQTFhcf/aAAgBAQABPyF7hgL1PDEjxjSGqqXYFEI9VAzIC4bhBHpiG8pBCduu/H7XEEAhn//aAAwDAQACAAMAAAAQaO//xAAaEQEBAQADAQAAAAAAAAAAAAABIREAMUFx/9oACAEDAQE/EJvrAUm073y5uCCvGQF9+8//xAAaEQEAAgMBAAAAAAAAAAAAAAABMUEAESFR/9oACAECAQE/EEMpIJ2zLgU2faXwF5//xAAbEAEBAQACAwAAAAAAAAAAAAABEQAhQTFRcf/aAAgBAQABPxAN1DLk4fXL2wykWbg3CBGIDIMCbBz6uiaslB8wwInIxAqE9gxIIwjUYHwG/9k=",
    width: 21,
    height: 13,
    rgba: "jnmI/5N+jf+nhKL/p4Si/8J3uP/NgsP/1H/U/9aB1v/zf+D/8n7f//p86P//ge3/9If//++C///zhu//6Xzl/+l82f/hdNH/wH+1/7x7sf+jgp3/l4KR/5iDkv+mg6H/rImn/8l+v//MgcL/14LX/+OO4//yft//94Pk//+L9//6fOj/6Xz5/++C///zhu//9Yjx//GE4f/oe9j/xYS6/79+tP+nhqH/lnab/6GBpv/Pd6r/13+y/+F/1v/lg9r/9n75//R89//vhfP/9437/7Gb7v+git3/FoKM/wVxe/+ekNv/sqTv//SK7//tg+j/1YXK/8x8wf+5ga7/poar/6CApf/KcqX/24O2/+WD2v/ph97//ob///qC/f/tg/H/4njm/4x2yf9nUaT/LZmj/y2Zo/9lV6L/mIrV//CG6//xh+z/24vQ/89/xP+7g7D/pnSl/7aEtf/giLv/4Ym8//Zu9v//ef//zZz4/7iH4/+gho//eF5n/1JmHv+4zIT/MhEA/z0cAP/NwZf/vrKI/+N97f/th/f/6Yng/9x80//OfLz/q3mq/7SCs//ZgbT/3oa5//+A////g///r37a/49euv+3nab/uqCp/5uvZ/8oPAD/QB8A/z0cAP8vIwD/gnZM/9p05P/th/f/7Izj/95+1f/SgMD/rICz/62BtP/jeMr/9Inb/8ah/v+RbMn/Xmk+/5+qf//f00P/zcEx/wtJAP8sahf/AGQA/wBJAP+aTQD/14oe/89w5P/mh/v/8ovn/+R92f/efMf/qX2w/7aKvf/lesz/6n/R/8ah/v+KZcL/Tlku/6u2i/+QhAD/NioA/6HfjP8lYxD/JYoA/2LHO///s0f/wHMH/85v4//mh/v/8Yrm/+J71//efMf/rH6j/7WHrP/bf8D/44fI//6F+P/7gvX/l4XP/3Jgqv8xeqP/W6TN/3GhVf9djUH/JsIA/0zoGv/G1kD/ZHQA/9B04//lifj/8Izk/+F91f/XesD/rH6j/7OFqv/Xe7z/3YHC//h/8v//h/r/sqDq/6GP2f9Ikbr/MHmi/0FxJf+by3//Yf0v/zvXCf9rewD/ssIs/9p+7f/ni/r/7Ynh/9560v/Web//oHun/6iDr/+7hbb/woy9//B93P/6h+b//3/3//9+9v/igu3/2nrl/216rv9GU4f/wKKX/0EjGP9aSY//jXzC/+uJ8P/ti/L/4YnV/9V9yf/JgLf/nXik/6R/q/+4grP/voi5/+l21f/ue9r//3Xt//958f/ri/b/5ITv/6Sx5f+LmMz/akxB/5V3bP+fjtT/uKft/+2L8v/ohu3/2oLO/9F5xf/FfLP/o3ud/6V9n/+xfLT/toG5/9h2yf/efM//5oTR/+uJ1v//ffv//3r4/+x6///6iP//33j//+R9///3h+v/94fr//GD5v/qfN//0IHC/8l6u/+ygKb/",
    tolerance: 3,
  },
  {
    name: "jpeg: progressive, restart markers",
    file: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wgARCAANABUDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAUCAwb/xAAWAQEBAQAAAAAAAAAAAAAAAAAFAwT/3QAEAAL/2gAMAwEAAhADEAAAAdKifiT9hEtp/8QAGhAAAgMBAQAAAAAAAAAAAAAAAgMBBAUSEf/dAAQAA//aAAgBAQABBQJXFdNjacOm9cFP/9CqXYFmRB2D8L//xAAeEQABAwQDAAAAAAAAAAAAAAABAAIRAxIh8AQUMv/dAAQAAv/aAAgBAwEBPwGqzkvYzr+cTmDukKpZeZX/xAAeEQABBAEFAAAAAAAAAAAAAAABAAIDEgQRFGHB0f/aAAgBAgEBPwGZmY+IbFwB5960UlLlf//EACAQAAEEAQUBAQAAAAAAAAAAAAEAAgMREjFBUWFxIZH/3QAEAAP/2gAIAQEABj8CD3bnEDkqGGNhki+5GEZNr39870QPK//QwcMmnYoBkhZGdW1d9Xx0qX//xAAbEAEBAAMBAQEAAAAAAAAAAAABEQAhQTFhcf/aAAgBAQABPyF7hgL1PDEjxjSGqqXYFEI9VAzIC5//0DcII9MQ3lIITt134/a4ggEM/90ABAAC/9oADAMBAAIAAwAAABBo7//EABoRAQEBAAMBAAAAAAAAAAAAAAEhEQAxQXH/2gAIAQMBAT8Qm+sBSbTvfLm4IK8ZAX37z//EABoRAQACAwEAAAAAAAAAAAAAAAExQQARIVH/2gAIAQIBAT8QQykgnbMuBTZ9pfAXn//EABsQAQEBAAIDAAAAAAAAAAAAAAERACFBMVFx/90ABAAD/9oACAEBAAE/EA3UMuTh9cvbDKRZuDcIEYgMgwJsHPq7/9CJqyUHzDAicjECoT2DEgjCNRgfAb//2Q==",
    width: 21,
    height: 13,
    rgba: "jnmI/5N+jf+nhKL/p4Si/8J3uP/NgsP/1H/U/9aB1v/zf+D/8n7f//p86P//ge3/9If//++C///zhu//6Xzl/+l82f/hdNH/wH+1/7x7sf+jgp3/l4KR/5iDkv+mg6H/rImn/8l+v//MgcL/14LX/+OO4//yft//94Pk//+L9//6fOj/6Xz5/++C///zhu//9Yjx//GE4f/oe9j/xYS6/79+tP+nhqH/lnab/6GBpv/Pd6r/13+y/+F/1v/lg9r/9n75//R89//vhfP/9437/7Gb7v+git3/FoKM/wVxe/+ekNv/sqTv//SK7//tg+j/1YXK/8x8wf+5ga7/poar/6CApf/KcqX/24O2/+WD2v/ph97//ob///qC/f/tg/H/4njm/4x2yf9nUaT/LZmj/y2Zo/9lV6L/mIrV//CG6//xh+z/24vQ/89/xP+7g7D/pnSl/7aEtf/giLv/4Ym8//Zu9v//ef//zZz4/7iH4/+gho//eF5n/1JmHv+4zIT/MhEA/z0cAP/NwZf/vrKI/+N97f/th/f/6Yng/9x80//OfLz/q3mq/7SCs//ZgbT/3oa5//+A////g///r37a/49euv+3nab/uqCp/5uvZ/8oPAD/QB8A/z0cAP8vIwD/gnZM/9p05P/th/f/7Izj/95+1f/SgMD/rICz/62BtP/jeMr/9Inb/8ah/v+RbMn/Xmk+/5+qf//f00P/zcEx/wtJAP8sahf/AGQA/wBJAP+aTQD/14oe/89w5P/mh/v/8ovn/+R92f/efMf/qX2w/7aKvf/lesz/6n/R/8ah/v+KZcL/Tlku/6u2i/+QhAD/NioA/6HfjP8lYxD/JYoA/2LHO///s0f/wHMH/85v4//mh/v/8Yrm/+J71//efMf/rH6j/7WHrP/bf8D/44fI//6F+P/7gvX/l4XP/3Jgqv8xeqP/W6TN/3GhVf9djUH/JsIA/0zoGv/G1kD/ZHQA/9B04//lifj/8Izk/+F91f/XesD/rH6j/7OFqv/Xe7z/3YHC//h/8v//h/r/sqDq/6GP2f9Ikbr/MHmi/0FxJf+by3//Yf0v/zvXCf9rewD/ssIs/9p+7f/ni/r/7Ynh/9560v/Web//oHun/6iDr/+7hbb/woy9//B93P/6h+b//3/3//9+9v/igu3/2nrl/216rv9GU4f/wKKX/0EjGP9aSY//jXzC/+uJ8P/ti/L/4YnV/9V9yf/JgLf/nXik/6R/q/+4grP/voi5/+l21f/ue9r//3Xt//958f/ri/b/5ITv/6Sx5f+LmMz/akxB/5V3bP+fjtT/uKft/+2L8v/ohu3/2oLO/9F5xf/FfLP/o3ud/6V9n/+xfLT/toG5/9h2yf/efM//5oTR/+uJ1v//ffv//3r4/+x6///6iP//33j//+R9///3h+v/94fr//GD5v/qfN//0IHC/8l6u/+ygKb/",
    tolerance: 3,
  },
  {
    name: "jpeg: greyscale",
    file: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/wAALCAANABUBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AOssTaadp6XVwCd7rFGgHLuxwqj6n1rndV8aanH4zsdMsbOW6siXNxJYxrNEqDjcXOAwDBlYqQEKnlmBQdVqltFI8cqrgOu7H1qLQ5RPatbTxLLE4wysMgiiXwzGtzGlpfTW1s7BpYgiuWUDHl7myRGR1XpwMYy2X6xOVnVFUBVGAPav/9k=",
    width: 21,
    height: 13,
    rgba: "goKC/4SEhP+RkZH/j4+P/5SUlP+kpKT/pKSk/6Ghof+np6f/qqqq/66urv+xsbH/sLCw/7e3t/+pqan/r6+v/6mpqf+cnJz/mpqa/5iYmP+Ojo7/goKC/42Njf+Xl5f/mZmZ/5ycnP+fn5//pKSk/7CwsP+0tLT/tLS0/7Gxsf+2trb/rKys/6ioqP/BwcH/ra2t/6+vr/+jo6P/n5+f/5ubm/+QkJD/j4+P/5CQkP+Li4v/mJiY/6mpqf+srKz/rq6u/7Gxsf+urq7/srKy/7CwsP+ampr/YWFh/1paWv+Pj4//s7Oz/7W1tf+tra3/p6en/5+fn/+UlJT/iIiI/5WVlf+cnJz/pKSk/6SkpP+pqan/uLi4/7W1tf+1tbX/nZ2d/5CQkP9eXl7/bGxs/4SEhP9lZWX/oKCg/7Kysv+ysrL/ra2t/6Ojo/+ZmZn/jIyM/5aWlv+lpaX/rKys/6ioqP+zs7P/tbW1/5ycnP+Li4v/dnZ2/1ZWVv+1tbX/Jycn/xsbG//IyMj/o6Oj/6mpqf+ysrL/sLCw/6Wlpf+dnZ3/lpaW/5GRkf+dnZ3/qKio/7W1tf+1tbX/lZWV/319ff+fn5//paWl/5mZmf86Ojr/HBwc/x8fH/8bGxv/fn5+/6CgoP+wsLD/srKy/6ampv+goKD/jIyM/5WVlf+qqqr/rKys/7Kysv+NjY3/ZGRk/5aWlv/Gxsb/ycnJ/yIiIv9HR0f/Ojo6/ycnJ/9YWFj/j4+P/5ubm/+xsbH/tLS0/6ampv+hoaH/kpKS/5ubm/+oqKj/qKio/7i4uP97e3v/SUlJ/7S0tP90dHT/GBgY/8TExP9OTk7/WFhY/52dnf+5ubn/gYGB/5qamv+zs7P/tbW1/6Wlpf+hoaH/kZGR/5qamv+ioqL/qamp/7Ozs/+wsLD/kpKS/29vb/9jY2P/nZ2d/4yMjP9wcHD/hYWF/6ampv+2trb/ZWVl/56env+urq7/s7Oz/6enp/+cnJz/jo6O/5WVlf+enp7/pqam/7Kysv+4uLj/ra2t/5ycnP+BgYH/Z2dn/0hISP/CwsL/q6ur/46Ojv92dnb/paWl/6ioqP+xsbH/srKy/6ampv+cnJz/jIyM/5KSkv+ZmZn/oaGh/6qqqv+zs7P/tra2/7a2tv+vr6//oaGh/46Ojv9RUVH/qKio/y8vL/9JSUn/k5OT/7Kysv+ysrL/ra2t/6Ojo/+ampr/ioqK/46Ojv+Wlpb/np6e/6Ojo/+np6f/rKys/7Kysv+xsbH/ra2t/6Wlpf+ZmZn/X19f/39/f/+ampr/q6ur/7S0tP+urq7/paWl/56env+Xl5f/h4eH/4qKiv+RkZH/m5ub/6Ghof+kpKT/qamp/6+vr/+0tLT/ubm5/7a2tv+/v7//m5ub/7i4uP+vr6//ubm5/7Gxsf+pqan/oKCg/5ubm/+Wlpb/",
    tolerance: 2,
  },
  {
    name: "jpeg: Adobe CMYK",
    file: "/9j/7gAOQWRvYmUAZAAAAAAA/9sAQwADAgIDAgIDAwMDBAMDBAUIBQUEBAUKBwcGCAwKDAwLCgsLDQ4SEA0OEQ4LCxAWEBETFBUVFQwPFxgWFBgSFBUU/8AAFAgADQAVBEMRAE0RAFkRAEsRAP/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAA4EQwBNAFkASwAAPwD608K3vhr4S+BdP17WYnubjUL+30jTLGBQZL2+nbZBApJCqXYgbnKqOpIGTTooy5AHWvqbwQvhb4a+ApfFvieYw6dA8cKrHGXeWZztjjUDqzMQB2r9U68R8a/tc/Eib9q7QPA2iatpdpp1iLy71Hw/pOnpdre2sKOGVp7trYrOHhmBTMSptRjJKGKJV1DULix1ywsbPQNV8SafO7x3WtaAqXlnZAbQkpkRiksIk3xyyKwWJkdcvIjRD5k8c/8ABV2Gy+JXg6HQ9AS08Bai8M3225EsaS2rXE1tcPPG9m0kgTymdDavgMhVjI2+JCvpDx94asNdk0vVYYBFHfWq3AQ9V3AHH61ZZcHFfW/xW8G2La3DPDGEjnj8wLjpnBorM+EGoW/i3wpceHdb0631XR72Iw3FpdKHjkUjBBBGDSIxFZ/wS8Tvc6U+l3lrDe6fcp5U1vOAySKRgggjBFFcjc/sFeEdE+JXh/UvDerXfh+0tbqC/tY4YhLdWbwPGyww3Dkn7M6x7Gt5VkjHWMRlpPM27XxhrdhoV7o1rqT2+l3+9L61WGJxdxNG0bROzoWCEMCQpXJUA5GQcX4wf8E7/h98bPid4c8aaxeak8ViYhc6Zd3U92kttCshjtYTJLtghLyBnUI2dmF2bnLFd38UNefTtWtrG2hWK2tYhDEgPAVQAB+QrFJya3/iz4onfxEEWNY0jXYqg8ADGKK//9k=",
    width: 21,
    height: 13,
    rgba: "i3+H/5J/lP+igJn/rYCk/7x/tf/FgLv/1oHD/92C0f/sftn/7oPi//GD6///fu3/+IHz//uH7//1f+7/7oDd/+KA1f/SgMH/x4C3/7OArf+jgJv/kH+Q/6R/lf+mgKX/voCx/8aAvf/VgMP/5YDT/++B4v/ygOz//4D0//+A8v/vff//8YD6/+6B+//4e/3//ob2//GA5//ggNP/0YDD/7+Atf+wgKT/lX6P/6d/ov+/gLP/v4C1/+SAyv/lgNz/94Du//2B7v/+fvv//ob+/91///+3ifD/GoVk/wCGIP+7ffH/9IT4//6A+P/ygOX/3oDQ/8uAvf+8gKz/pH6c/6x/p//AgLH/1IHE/+eA3//zgN///ID2//iB///nhvn/x4Ly/4V9x/8ZgmD/EYvz/we2tP8chGX/poHg//WB+//9gfH/6oHb/9OAxv/BgLP/on+d/7V/r//TgL7/5oHV//CB6v//gfb/+oH//8yC7/+Hhcv/QYCb/wSLMP/oyQD/Kx0A/yUkCP/D6gD//4qS/9aC9P/9gfj/9YHm/9qA0P/EgLv/rH+c/72AtP/LgM3/6IHe//+B7v/xgv//vIPg/z2El//9hXf/7Y9R/7WG6P8TSwD/MR0C/0UTAf99AAL/EJPp/7aC6f/4gvn/+4Hr/+OA1v/KgMD/rYCq/72Ar//ggMb/+IHm//aB+P+Ag8z/D4Vl//SHXv/A6QH/f/8D/5ECAP8AggX/A2EG/0YNAP/cKAP/1I8F/6qD4v/3gvn/+4Hs/+eA1//OgMH/q4Ch/8SAtv/SgMv/9IHl//uB//9WhKv/AoYl//yJg//3UAD/UQMA/27r5P8FegD/AJgD/zrwAP/mxwP/moYS/62D4f/5gvz/+oHt/+aA2P/PgMP/qoCf/76Atf/SgMT/74He//6B9f/xgv//pYLa/yuDgP8Giqr/hI7+/2mL9/8Puwr/Gc4A/0rxAP9++QH/5TcB/62C5f/+gvr/9YHs/+OB0v/OgMP/pn+g/7uAsf/NgL//5IDX//OB6f//gvr/9IL//72C6v9ihLL/K4aG/wSCFv/2uwD/Y/4A/yndBv8KtwD//4Zt/86C8///gfz/8YHn/96AzP/JgLz/m3+W/69/pv/Bf7T/14DM/+eA2//1geX//4H5//WB/f/lf/z/v4Lo/26Dtv8CiEv/1IXK/5EIAP8AiEf/h37S//GB/f//gfb/6YHe/9eAx//DgLb/nn+W/6x/p/+4f67/y3+9/92Az//pgNz/+IHt//uB9P/+h/3/84L8/91++/+fg9v/E4lU/5x8GP+qgt7/84b4//yB9f/zgeb/3oHQ/82Awf+6gK//jn6K/6B/nP+tf6T/vH+t/8uAvf/YgMr/6IDZ//SA5v/6fu3//HTv//2K///4f/7/1YHz/9uH+//6gv///IP2//eB6P/lgdb/1IDE/8KAuv+xgKf/",
    tolerance: 2,
  },
  {
    name: "gif: interlaced, transparent index",
    file: "R0lGODlhCwAJAIIAAPqB9+6A4NqAzMyAy7eCt2+Ve4lqZwAAACH5BAEAAAEALAAAAAALAAkAAAhGAA0QICAgAICDAQYMJGgQQAECAAQMHGAwQIGLARISBKCwgAEDAyISSOjxo0CRGT1efChSAACLK11KHHmQwMeMChnWNCgxIAA7",
    width: 11,
    height: 9,
    rgba: "iWpn/7eCt/+3grf/2oDM/wAAAAD6gff/+oH3//qB9/8AAAAAzIDL/7eCt/+3grf/t4K3/9qAzP8AAAAA+oH3//qB9/9vlXv/t4K3//qB9//agMz/t4K3/7eCt//MgMv/AAAAAPqB9/8AAAAAb5V7/2+Ve/9vlXv/AAAAAAAAAADMgMv/t4K3/9qAzP/6gff/zIDL/7eCt/9vlXv/iWpn/4lqZ//MgMv/+oH3/9qAzP+3grf/AAAAAMyAy/9vlXv/iWpn/4lqZ/+Jamf/iWpn/7eCt//6gff/2oDM/7eCt/8AAAAAAAAAAG+Ve/+Jamf/b5V7/2+Ve/9vlXv/t4K3//qB9//agMz/t4K3/9qAzP/6gff/AAAAAG+Ve/9vlXv/b5V7/2+Ve//agMz/+oH3/9qAzP+3grf/t4K3/wAAAAD6gff/+oH3/7eCt/+Jamf/iWpn/wAAAAAAAAAAzIDL/7eCt/+3grf/2oDM/wAAAAD6gff/+oH3/7eCt/8AAAAA+oH3/9qAzP+3grf/",
    tolerance: 0,
  },
  {
    name: "webp: lossy",
    file: "UklGRtwAAABXRUJQVlA4INAAAADwBACdASoVAA0APm0qkUWkIqGYBABABsS2AE6ZQjwdYCVLiIYF54UODlRen0mcWMgA/ftRJuN+2UZxmCwhjDacKYsxJorXrsMvcddB3Wowp6db/z972J2w6bcFqmu7+LGwmCBH1cyey1cHWRI0KBvL2fTIvXcf5JbBuNn579KeGbNwL/NnEk/6/9P+P/lcWf9WTn4bxf8Ic5f1M1vebCf9vjMUn8rrDY+KY98D3GPi3y3Q5TVxOJZxtLtfVGtdLSSZe1qx9xJKmsoctjKaAAAA",
    width: 21,
    height: 13,
    rgba: "lnuJ/5t9kv+jf6T/rH+z/7iBv//Dgsb/0YTJ/91/1v/oduj/7HPw/+p78//shfr/7on//++L+v/nhOP/4n3Y/+d+4f/cftn/yn7I/7yAuf+seqb/m32Q/6B+mv+rgKr/tYC2/8GBxP/Mgs3/2ITX/+OC4v/vfvT/9IX//+2Q/f/elfb/zJnv/7+N3v/cluv/44vm/+eD5//hgN7/0YDL/8OAvf+yeqv/o4Ce/6uBpv+2gbD/w4C9/9GAzf/cf97/5YHu/+qC+f/uhv//6ZD//8mQ6v+VisT/Omt//zBhd/+cj9H/zJDt/+aK8P/pguX/3IHS/9GBxf++fLL/qn+n/7KArP/Cf7j/z4DG/9p/1//igOX/54T1/+eJ+//hivD/0ZDf/5l9qf9SYmz/SI55/1qdjf9ZX3//sYbJ/+aQ7//uher/5YHZ/9qByv/IfLj/r3qn/7t+sv/Of8P/3YLT/++Q6//rkfH/2Ynr/9CJ3P+zdqj/kWh2/11WPf+4xJf/JDEI/yInBv/Kv6z/wput/9aF1f/uhvD/64He/+SB0P/Qf7//tnel/8J8tv/Xfcv/44Pe/+eM6//dkuf/vYvO/4Vfg//Hn5j/sZpy/6ixbv8qPQD/JS0A/y4oAP9ELwD/lGZP/9KDxP/siPP/74Li/+Z/1P/QfsP/wHam/8t7uP/efdf/6Ijq/+KU7v+icbH/XVNn/6enjv/Wwn7/zr5o/ys5AP8/ZRb/IFYA/xs4AP99YAD/xoZQ/82At//ojPb/8Ybn/+eA1//Of8X/v3qm/81/uf/gftb/7Ynr/+mW8P+WYqP/WVNn/6GumP+EhUn/KjUA/7ndjf8kYwX/In8A/3/GOv/NxUH/snk2/8p9rv/mjfT/8Irq/+SC1f/Of8X/soOn/8OFtf/cfsn/74Pc//GL6f/djeP/rIXL/2ZhkP9SbX3/dKeP/2iwY/88nh//NLcG/2vZIv+z10T/eV4a/8uCsf/qiu//7Yzm/+CD0v/Rf8T/pYSk/7aErv/Rfr//5X/P/+uB3v/jg+b/zIjq/7aR6/99fMf/SmyM/yppQ/+B2nj/cN1G/2K/Jf9ZgRj/uqmG/9SLxP/tiev/5Yje/9mCzf/NfMD/nICe/6mBqP/AgLj/z4DG/+OF3P/jguL/4YXt/9+J9f/SgvP/w5Tv/3mHq/9BaV7/o8CJ/x0uAP9WXVL/oIao/+KT4v/ui+r/4IXY/9KAx//Fe7v/mYCb/6GAov+vf63/w4C9/9qE0//kgN//8ITs//iD+P/6gP//6o7//7GU4v+Tibj/bUxh/5hth/+uh8L/0Jrs/+mP7f/sh+T/3ITU/8+Cxf/Afrn/loGT/5yBmv+ogKf/uoK3/9ODy//jgNj/8Hvi//p87f/6fvj/74b3/9iU6//RleD/2Y3Z/+GK3v/oivP/8Yr6/+2B6v/nf9v/1YDK/8Z+vf+2e6//",
    tolerance: 0,
  },
  {
    name: "webp: lossy, alpha",
    file: "UklGRjIBAABXRUJQVlA4WAoAAAAQAAAAFAAADAAAQUxQSD8AAAABZyAkSHG3SkREG7PBkLZtKX+eR4WvkEIKKaSQQgoppJBCXIchov8paIJcoDbQO5gD7AnuAn9DeCC+kD7IPxQAVlA4IMwAAADwBACdASoVAA0APm0qkUWkIqGYBABABsS2AE6ZQjwdYCVKiIYF54UODlRcorbPxEAA/ftRJuN+2UZxmCwhjDacKYsxJorXrsMvcddB3Wowp6db/z972J2w6bcFqmu7+LGwmCBH1cyey1cHWRI0KBvL2fTIvXcf5JbBeDNc+mo7V8eY4AWr/8/9P+P/la3v9azn4bb9+Zs6v1Mx/Kt7UdZasSn3vODk5tS9DdiPbUS+xmdfLJXNWXAwPG+F5c94UzLhFg4h0eQkfFOSAAA=",
    width: 21,
    height: 13,
    rgba: "nneHCqN5kAqre6IKtHyxCsB9vQrLfsQK2YDHCuJ91ArodugK6nTuCut86wruhvIK6Yz7CuqM/wrmgfUK4nnqCud95wrcftkKyn7ICryAuQqseqQKonqOHad8mB2xfagdu360Hcl+wh3Ufssd3oHVHeeB4B3vf/Ad84f7HeuS9x3clvIdyprxHb2N5h3bk/sd4Yn0HeaD6x3hgN4d0YDLHcOAux2ye6kdpn+cMa5/pDG7f64xyH67MdV+yzHffdwx6X/sMe2C8zHwh/gx6JP5McOT6DGPjMoxO2iLMTNdhTGbjt0xx5D1MeSK8jHpguUx3IHSMdGCwzG+fbAxqn+lRLKAqkTCgLZE0X/ERNx+1UTigONE54XzROiK9UTjjOJE0ZLTRJR/q0RNYnlESIuJRFyZnURVX4lEsIbPROSQ8UTuhepE5YHZRNqBykTIfbZErHylWLiAsFjLgcFY2oTRWOuS6Vjok+9Y1ovpWMuN1liwe5pYj2tsWF9UP1i6waNYHzEZWBsnFljIvrRYwpqxWNaF11juhvBY64HeWOSB0FjQf79Yr3ujbLx/tGzRgMls24fcbOCQ6WzXluVst4/MbH9jf2zApI5sr5xobKuvbmwrOwBsIC0AbCgpAGxCLQBslGRXbNKCyGzsiPNs74LibOaA0mzQfsFss32kgMCBtoDUgtWA3o3ogNmZ7ICZdq+AVFllgJ+rjIDTxHyAzMBkgCk7AIA9ZhSAH1YAgBk3AIB6XwqAw4RggM1/u4DojPaA8YbngOeA1YDOf8OAtYCkk8OFt5PYgtST5Y7pk+Gb7pOOZ6GTUVhlk52xmJODhUmTKjUAk7bgiZMhZgCTIoAAk4HEPpPLw0+Tr3hEk8h9tJPojPST8onqk+WB15POf8WTsoOlp8OFs6fcf8en7YTap/GM56fbjuGnrIXJp2RijqdSbX2ndKiNp2axYac6nxunNLcEp2rZIqey10ineF4ep8uBs6fsifGn8Irop+GC1KfTfsanq4Giu7qCrLvVfb276H7Nu+6A3LvmguS70Ifou7iR6bt7fcW7SW2KuytoQbuB23a7a+BEu13CI7tZgRa7uqmGu9aKxrvviO276Ybgu9x/z7vPe8K7oH6czq2Aps7Df7bO037EzuaE2s7ngeDO5ITrzt+J887NhPHOv5btzoGEqc5HZ1zOmcWHzhE0AM5WXVDOpYSmzuWR5M7yiezO44PaztV+yc7Ieb3OnH+Z4qR/oOKzfqvixn+74t2D0eLnf93i84Lq4viD9uLzhP/i55D/4ryP4OKbhrbiYlJf4ol1heKuiMDi1pbs4uyN7+Lwhebi4ILW4tKAx+LEfLvimYCR9Z+AmPWsf6X1vYC19daCyfXmf9b183rg9fp96/X0gvb17Yf19eSO6fXZkt71zpPX9dSR3PXoivH19Yj49fJ/6vXqfd312H7M9cl8v/W5ebH1",
    tolerance: 0,
  },
  {
    name: "webp: lossless",
    file: "UklGRoACAABXRUJQVlA4THQCAAAvFAADAHfmNpJsNWoxWApC+ZtK5WxmZubLAW5t26qqg7tE7l4AhdApKU3Qw4/d9d5z9nIb27aqbBwyWqAHWqBdYmIaIXN3vWfPP4GkTYBtf436yDiw6eHYw72MaxebLpIRniUoIWxBBZMTLnW0F7iXcC7jscQ+YZIwFm4g8gIAaAAAAhAYAAIXgQQICXFBQkJS8JDD758IQC48ggghCoKIbDBguXMoBxNEAUEAEwD9clRI3wkAxATwv+8OJgqA4jtDFBFPBEF/kxCAKCQI4H8QLxQk/18xE7xAgPsz6cf7Q/B25ffN24X04XUPweTvTn4L8h3+xIbik9rd7WsFUJCCmJiYmCAmJghigpggBAQhngABMVFQQBAFxf9RRPUxdrwNccUvK+7agutZ/vt1fp275SV2RXf080xnfi9a46l5DcE9Bu84/KE5o+yg6GO3WxheRgZPM4AYAADBxLZmZbe8bNu2uZZtN9v2lm1bV3VERP9jcmywo74sM3ZHLRVweRLNcXZ5C3ZiuLO+OGVfLWZTIZ7uAI7iIKemfbS/uTRpR86lQrxCVwkhMJbqtLBxqK0ifUfKBHkEza5d/61joHx9ehW2ueBIzoAFzizi7Q0Mbe/8acr4st66DB0biV56eI5+NTIxvwkjSw4LuquTFcDpjScbC2uXF+OPs0iQaC+3qzpJAV7A37+Z/rg6f9ld/OupTdcy3SJWbi+vHH+/Ld/DAZKDvIGmvAMpDRU8v0x0MPt0egygKeJKcK3lqXoxHeKNntuOsdqagnN1aRUjfY1FCXopmwL3xWyeR6EYipP8hnFcR11B4q5SyCQh/HzATNleVmUr",
    width: 21,
    height: 13,
    rgba: "in+I/5V/kf+if5v/rn+l/7uAsP/HgLv/04DG/96A0P/ogNn/8IDh//aB6f/6ge///IHy//uB8f/3ger/7oDf/+GA0//SgMX/w4C3/7SAqv+lf57/kX+O/55/mf+sf6T/u4Cw/8mAvf/YgMn/5IDV//CA4f/4gev//YH0//6B+v/4gf7/6IL8/+uC/f/8gf3//YHz//OA5f/jgNT/0YDE/8CAtP+vf6b/mX+U/6d/oP+3gK3/yIC7/9mAyv/ogNn/9IDn//yB8v/+gfr/+IH+/+WC+/+2guf/F4Rp/wKFIf+7gur/9YH+//2B9f/ygOP/34DQ/8uAvv+5gK7/n3+Z/7B/p//CgLb/1YDH/+iA2f/2gen//oH2//qB/f/pgvz/yILw/4ODyf8WhGf/HYzu/wezuP8WhGb/pYPe//eB/v/7gfD/6oDb/9WAx//BgLX/pX+e/7eArf/MgL//4oDT//SA5//+gff/9YH+/82C8v+Eg8n/R4Sb/wCFK//swwD/JyQA/yQoAP/L5QD//omQ/9eC9v/+gfn/8oDk/92Azv/HgLv/qX+h/72Asv/UgMb/7IDd//2B9P/zgv7/vILq/z6Ek//8iXb/64hS/7uK5/8LTAD/MxoA/0YOAP96AAD/FJTo/7KC5f/8gfz/94Hq/+KA1P/MgL//q3+j/8CAtf/YgMr/84Dl//uB/f+Fg8r/DoRa//SIYf/D6wD/ff8A/5ABAP8BggD/BF8A/0IRAP/dKQD/0ZAE/6qD4P/6gf3/+YHt/+WA1v/PgMH/rH+j/8CAtf/ZgMr/84Dl//mB/v9Xg6n/AIUr//6Jgv/0TQD/VAkA/23m3/8AfgD/A5kA/znpAP/pxgD/mYcT/6qD4P/6gf3/+YHt/+WA1v/PgMH/qn+i/76Asv/VgMf/7YDe//6B9v/tgv3/rIPi/yiEff8Djar/h4v6/2aL/v8PugD/G80A/0nyAP+A/wD/5TMA/6+D4//8gf3/94Hq/+OA1P/NgMD/pn+e/7iArv/NgMD/44DU//aB6f/+gfn/8YL+/7+C7P9mg7T/LoSE/wmFFf/wvAD/YvsA/yzfAP8JrwD/+olx/9GC9P/+gfn/84Dl/96Az//IgLz/oH+a/7GAqP/DgLf/14DJ/+qA2//4gev//oH4//iB/v/igvr/vILq/2yDuf8DhUL/2orS/4sBAP8EhUb/iYPN//SB/v/8gfL/7IDd/9aAyP/CgLb/mn+V/6h/of+5gK7/yoC9/9uAzP/qgNv/9oHp//2B9P/9gfv/9IH+/92C+P+lg97/CYRS/52HFP+og+D/8YL+//6B9//zgOX/4IDS/82Av/+6gK//k3+P/6B/mv+uf6X/vYCy/8yAv//agMv/54DY//KA5P/6ge7//oH2//2B/P/0gv7/2oL3/96C+f/5gf7//oH2//WB5//lgNb/04DF/8GAtv+xgKj/",
    tolerance: 0,
  },
  {
    name: "webp: lossless, 4-colour palette",
    file: "UklGRoIAAABXRUJQVlA4THYAAAAvFAADAB8gECAuFJvzJERIQOyw3Tc7RCEB8X+aaILkxvyH94YIgVFr21H+I0FCt9Xy64CxLSggNYEFRBB2aEAJBub9PJmI6H+4lCj1ckGUIAfLAJpqx9A8lAxR9Z2CKPb7X3cFUTWDgubNMTTVLUODZYDcJ0oA",
    width: 21,
    height: 13,
    rgba: "cZaR/3GWkf9xlpH/1oDI/9aAyP/WgMj/1oDI/9aAyP/4hOH/+ITh//iE4f/4hOH/+ITh//iE4f/4hOH/+ITh/9aAyP/WgMj/1oDI/9aAyP9xlpH/cZaR/3GWkf/WgMj/1oDI/9aAyP/WgMj/1oDI//iE4f/4hOH/+ITh//iE4f/4hOH/+ITh//iE4f/4hOH/+ITh//iE4f/WgMj/1oDI/9aAyP/WgMj/cZaR/3GWkf/WgMj/1oDI/9aAyP/4hOH/+ITh//iE4f/4hOH/+ITh//iE4f/WgMj/cZaR/4pfYv/WgMj/+ITh//iE4f/4hOH/1oDI/9aAyP/WgMj/cZaR/9aAyP/WgMj/1oDI//iE4f/4hOH/+ITh//iE4f/4hOH/1oDI/3GWkf9xlpH/cZaR/3GWkf9xlpH/1oDI//iE4f/4hOH/+ITh/9aAyP/WgMj/cZaR/9aAyP/WgMj/1oDI//iE4f/4hOH/+ITh/9aAyP9xlpH/cZaR/3GWkf+KX2L/il9i/4pfYv+KX2L/1oDI//iE4f/4hOH/+ITh/9aAyP/WgMj/1oDI/9aAyP/WgMj/+ITh//iE4f/4hOH/1oDI/3GWkf/WgMj/il9i/9aAyP+KX2L/il9i/4pfYv+KX2L/cZaR/9aAyP/4hOH/+ITh/9aAyP/WgMj/1oDI/9aAyP/WgMj/+ITh//iE4f9xlpH/cZaR/9aAyP+KX2L/cZaR/4pfYv+KX2L/il9i/4pfYv+KX2L/il9i/9aAyP/4hOH/+ITh/9aAyP/WgMj/1oDI/9aAyP/WgMj/+ITh//iE4f9xlpH/cZaR/9aAyP+KX2L/il9i/3GWkf+KX2L/il9i/3GWkf+KX2L/il9i/9aAyP/4hOH/+ITh/9aAyP/WgMj/1oDI/9aAyP/WgMj/+ITh//iE4f/4hOH/1oDI/3GWkf9xlpH/1oDI/3GWkf9xlpH/cZaR/3GWkf9xlpH/il9i/9aAyP/4hOH/+ITh/9aAyP/WgMj/cZaR/9aAyP/WgMj/1oDI//iE4f/4hOH/+ITh/9aAyP9xlpH/cZaR/4pfYv+KX2L/cZaR/3GWkf9xlpH/1oDI//iE4f/4hOH/+ITh/9aAyP/WgMj/cZaR/9aAyP/WgMj/1oDI//iE4f/4hOH/+ITh//iE4f/4hOH/1oDI/3GWkf9xlpH/1oDI/4pfYv9xlpH/cZaR//iE4f/4hOH/+ITh/9aAyP/WgMj/cZaR/9aAyP/WgMj/1oDI/9aAyP/4hOH/+ITh//iE4f/4hOH/+ITh//iE4f/WgMj/cZaR/4pfYv/WgMj/+ITh//iE4f/4hOH/1oDI/9aAyP/WgMj/cZaR/3GWkf/WgMj/1oDI/9aAyP/WgMj/+ITh//iE4f/4hOH/+ITh//iE4f/4hOH/+ITh//iE4f/4hOH/+ITh//iE4f/WgMj/1oDI/9aAyP/WgMj/",
    tolerance: 0,
  },
  {
    name: "webp: animation, first frame",
    file: "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",
    width: 21,
    height: 13,
    rgba: "in+I/5V/kf+if5v/rn+l/7uAsP/HgLv/04DG/96A0P/ogNn/8IDh//aB6f/6ge///IHy//uB8f/3ger/7oDf/+GA0//SgMX/w4C3/7SAqv+lf57/kX+O/55/mf+sf6T/u4Cw/8mAvf/YgMn/5IDV//CA4f/4gev//YH0//6B+v/4gf7/6IL8/+uC/f/8gf3//YHz//OA5f/jgNT/0YDE/8CAtP+vf6b/mX+U/6d/oP+3gK3/yIC7/9mAyv/ogNn/9IDn//yB8v/+gfr/+IH+/+WC+/+2guf/F4Rp/wKFIf+7gur/9YH+//2B9f/ygOP/34DQ/8uAvv+5gK7/n3+Z/7B/p//CgLb/1YDH/+iA2f/2gen//oH2//qB/f/pgvz/yILw/4ODyf8WhGf/HYzu/wezuP8WhGb/pYPe//eB/v/7gfD/6oDb/9WAx//BgLX/pX+e/7eArf/MgL//4oDT//SA5//+gff/9YH+/82C8v+Eg8n/R4Sb/wCFK//swwD/JyQA/yQoAP/L5QD//omQ/9eC9v/+gfn/8oDk/92Azv/HgLv/qX+h/72Asv/UgMb/7IDd//2B9P/zgv7/vILq/z6Ek//8iXb/64hS/7uK5/8LTAD/MxoA/0YOAP96AAD/FJTo/7KC5f/8gfz/94Hq/+KA1P/MgL//q3+j/8CAtf/YgMr/84Dl//uB/f+Fg8r/DoRa//SIYf/D6wD/ff8A/5ABAP8BggD/BF8A/0IRAP/dKQD/0ZAE/6qD4P/6gf3/+YHt/+WA1v/PgMH/rH+j/8CAtf/ZgMr/84Dl//mB/v9Xg6n/AIUr//6Jgv/0TQD/VAkA/23m3/8AfgD/A5kA/znpAP/pxgD/mYcT/6qD4P/6gf3/+YHt/+WA1v/PgMH/qn+i/76Asv/VgMf/7YDe//6B9v/tgv3/rIPi/yiEff8Djar/h4v6/2aL/v8PugD/G80A/0nyAP+A/wD/5TMA/6+D4//8gf3/94Hq/+OA1P/NgMD/pn+e/7iArv/NgMD/44DU//aB6f/+gfn/8YL+/7+C7P9mg7T/LoSE/wmFFf/wvAD/YvsA/yzfAP8JrwD/+olx/9GC9P/+gfn/84Dl/96Az//IgLz/oH+a/7GAqP/DgLf/14DJ/+qA2//4gev//oH4//iB/v/igvr/vILq/2yDuf8DhUL/2orS/4sBAP8EhUb/iYPN//SB/v/8gfL/7IDd/9aAyP/CgLb/mn+V/6h/of+5gK7/yoC9/9uAzP/qgNv/9oHp//2B9P/9gfv/9IH+/92C+P+lg97/CYRS/52HFP+og+D/8YL+//6B9//zgOX/4IDS/82Av/+6gK//k3+P/6B/mv+uf6X/vYCy/8yAv//agMv/54DY//KA5P/6ge7//oH2//2B/P/0gv7/2oL3/96C+f/5gf7//oH2//WB5//lgNb/04DF/8GAtv+xgKj/",
    tolerance: 0,
  },
];

/** A 2×2 lossless WebP, solid rgb(200, 30, 30). */
export const WEBP = "UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAdQjyLXo/+BiOh/AAA=";
