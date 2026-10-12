// Decoder fixtures: tiny files and the RGBA each decodes to. Generated
// 2026-10-12 with Pillow 12.3 (libjpeg-turbo) and ffmpeg. Truth: PNG exact
// (written from known samples); GIF exact (Pillow's decode, transparent
// pixels as zeros); JPEG ffmpeg's decoded planes with chroma replicated
// (what the decoder does), greyscale Pillow's decode, Adobe CMYK its
// channels multiplied out; `tolerance` covers IDCT rounding.

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
];

/** A 2×2 lossless WebP: for the format sniffer (WebP goes to ffmpeg). */
export const WEBP = "UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAdQjyLXo/+BiOh/AAA=";
