const Jeygame = {};
const JeygameInternals = {};

JeygameInternals.Instances = {};
JeygameInternals.Instances.Instance = class {
    constructor(sealed = true) {
        this.name = "Instance";
        this.attributes = {};
        this.parent = undefined;
        this.children = [];
        if(sealed) {Object.seal(this);}
    }
    clearChildren() {
        for(let i = 0; i < this.children.length; i++) {
            this.children[i].destroy();
        }
    }
    getChildren() {return this.children;}
    getFirstChildByName(name) {
        let chosenChild;
        for(let i = 0; i < this.children.length; i++) {
            if(this.children[i].name == name) {
                return this.children[i];
            }
        }
        return null;
    }
    getFirstChildByType(type) {
        let chosenChild;
        for(let i = 0; i < this.children.length; i++) {
            if(this.children[i] instanceof JeygameInternals.Instances[type]) {
                return this.children[i];
            }
        }
        return null;
    }
    addChild(child) {
        if(child instanceof JeygameInternals.Instances.Instance) {
            if(!(Object.isFrozen(child) || Object.isFrozen(this) && child.parent != this)) {
                this.children.push(child);
                child.parent = this;
            } else {
                console.warn("Child/Parent is frozen or destroyed!");
            }
        }
    }
    destroy(timeout = 0) {
        if(timeout) {
            setTimeout(() => {
                this.clearChildren();
                if(this.parent) {
                    let thisIndex = this.parent.children.indexOf(this);
                    this.parent.children.splice(thisIndex,1);
                }
                this.name = null;
                this.parent = null;
                Object.freeze(this);
                Object.freeze(this.attributes);
            }, timeout)
        } else {
            this.clearChildren();
            if(this.parent) {
                let thisIndex = this.parent.children.indexOf(this);
                this.parent.children.splice(thisIndex,1);
            }
            this.name = null;
            this.parent = null;
            Object.freeze(this);
            Object.freeze(this.attributes);
        }
    }
    setAttribute(attr, value) {
        this.attributes[attr] = value;
    }
    getAttribute(attr) {
        return this.attributes[attr];
    }
    removeAttribute(attr) {
        delete this.attributes[attr];
    }
}

JeygameInternals.Instances.GameController = class extends JeygameInternals.Instances.Instance {
    constructor() {
        super(false);
        this.name = "Game";
        this.children = [];
        this.renderBinds = {};
        this.renderFrame = 0;
        this.gameInfo = {"gameType": "canvas2d"};

        this.renderContext = null;
        let renderInterval = null;
        Object.defineProperty(this, "currentRenderInterval", {
            get() {
                return renderInterval;
            },
            set(value) {
                clearInterval(renderInterval);
                renderInterval = value;
            }
        })
        Object.seal(this);
    }

    bindToRender(id, func, always = false) {
        this.renderBinds[id] = {"callback": func, "always": always};
    }

    unbindFromRender(id) {
        delete this.renderBinds[id];
    }

    setRenderingCanvas(canvas) {
        if(canvas instanceof HTMLCanvasElement) {
            this.renderContext = Jeygame.RenderContext(canvas);
        } else {
            throw new Error("Tried to set rendering canvas to non-canvas object");
        }
    }

    clearRenderInterval(wipe = false) {
        this.currentRenderInterval = null;
        this.renderFrame = 0;

        if(this.renderContext && wipe) {
            this.renderContext.ctx.clearRect(0,0, this.renderContext.canvas.width, this.renderContext.canvas.height);
        }
    }

    setRenderInterval(refresh) {
        this.currentRenderInterval = setInterval(() => {this.render()}, refresh);
    }

    resizeCanvas(size) {
        if(size instanceof JeygameInternals.Datatypes.Vector2 && this.renderContext) {
            this.renderContext.canvas.width = size.x;
            this.renderContext.canvas.height = size.y;
        }   
    }

    render() {
        if(this.renderContext) {
            this.renderFrame += 1;
            Object.values(this.renderBinds).forEach(call => {
                if(call.always || document.visibilityState == "visible") {call.callback();}
            });
            let ctx = this.renderContext.ctx
            ctx.clearRect(0,0, ctx.canvas.width, ctx.canvas.height)
            for (let i = 0; i < this.children.length; i++) {
                let cs = this.children[i];
                if(cs instanceof JeygameInternals.Instances.Sprite) {
                    if(cs.renderer && !(cs.hidden)) {
                        cs.renderer.renderRoutine(cs, ctx, cs.position, cs.rotation);
                    }
                }
            }
        } else {
            console.warn("Jeygame: No rendering context defined!");
        }
    }
}

JeygameInternals.Instances.Sprite = class extends JeygameInternals.Instances.Instance {
    constructor() {
        super(false);
        this.name = "Sprite"
        this.position = Jeygame.Vector2(0,0);
        this.size = Jeygame.Vector2(10,10)
        let rot = 0;
        Object.defineProperty(this, "rotation", {
            set(value) {
                rot = value % 360;
            },
            get() {
                return rot; 
            }
        })

        this.renderer = undefined;
        this.hidden = false;
        Object.seal(this)
        this.setRenderer(Jeygame.Make("ShapeRenderer"));
    }

    setRenderer(renderer) {
        if(renderer instanceof JeygameInternals.Instances.ShapeRenderer) {
            this.renderer && !(this.renderer == renderer) && this.renderer.destroy();
            this.renderer = renderer;
            this.addChild(renderer);
        } else {
            console.warn("Invalid renderer!");
            this.renderer && this.renderer.destroy();
            this.renderer = null;
        }
    }

    removeRenderer() {
        if(this.renderer) {
            !(Object.isFrozen(this.renderer)) && this.renderer.destroy();
            this.renderer = null;
        }
    }
}

JeygameInternals.Instances.ShapeRenderer = class extends JeygameInternals.Instances.Instance {
    constructor(sealed = true) {
        super(false);
        this.name = "ShapeRenderer";
        this.renderSettings = {
            "shape": "rectangle",
            "color": "black"
        }
        this.renderRoutine = (spr, ctx, pos, rot) => {
            let ren = spr.renderer;
            let renSettings = ren.renderSettings;

            ctx.save();
            ctx.beginPath();

            ctx.fillStyle = renSettings.color;

            ctx.translate(pos.x + spr.size.x / 2, pos.y + spr.size.y / 2);
            ctx.rotate(rot * Math.PI / 180);
            ctx.translate(-(pos.x + spr.size.x / 2), -(pos.y + spr.size.y / 2));

            switch(renSettings.shape) {
                case "rectangle":
                    ctx.fillRect(pos.x,pos.y,spr.size.x,spr.size.y);
                    break;
                case "ellipse":
                    ctx.ellipse(pos.x + spr.size.x / 2, pos.y + spr.size.y / 2, spr.size.x / 2, spr.size.y / 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                default:
                    ctx.fillRect(pos.x,pos.y,spr.size.x,spr.size.y);
                    break;
            }
            ctx.restore();
        };

        if(sealed) {
            Object.seal(this);
        }
    }
}

JeygameInternals.Instances.ImageRenderer = class extends JeygameInternals.Instances.ShapeRenderer {
    constructor() {
        super(false);
        this.name = "ImageRenderer";

        let defaultImage = new Image();
        this.renderSettings = {
            "image": defaultImage,
            "cropPos": Jeygame.Vector2(0,0),
            "cropSize": Jeygame.Vector2(255,255)
        }

        this.renderRoutine = (spr, ctx, pos, rot) => {
            let ren = spr.renderer;
            let renSettings = ren.imageSettings
            ctx.save();
            ctx.fillStyle = "black";

            ctx.translate(pos.x + spr.size.x / 2, pos.y + spr.size.y / 2);
            ctx.rotate(rot * Math.PI / 180);
            ctx.translate(-(pos.x + spr.size.x / 2), -(pos.y + spr.size.y / 2));
            
            ctx.drawImage(renSettings.image, renSettings.cropPos.x, renSettings.cropPos.y, renSettings.cropSize.x,renSettings.cropSize.y, pos.x, pos.y, spr.size.x, spr.size.y);
            ctx.restore();
        }

        Object.seal(this);
    }

    setImage(url) {
        let newImage = new Image();
        newImage.src = url;

        this.imageSettings.image = newImage;
    }
}

JeygameInternals.Instances.SpriteBounds = class extends JeygameInternals.Instances.Instance {
    constructor() {
        super(false);

        Object.seal(this);
    }

    getIntersecting(bound) {
    }
}

JeygameInternals.Datatypes = {}
JeygameInternals.Datatypes.Vector2 = class {
    constructor(x,y,mag) {
        this.type = "Vector2";
        this.x = x;
        this.y = y;
        this.magnitude = 0;
        Object.seal(this);
    }

    valueOf() {
        return [this.x,this.y];
    }
    toString() {
        return `${this.x}, ${this.y}`;
    }
}
JeygameInternals.Datatypes.RenderContext = class {
    constructor(canvas) {
        this.type = "RenderContext";
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        Object.seal(this);
    }
}

Jeygame.Make = function(type, properties) {
    if(JeygameInternals.Instances[type]) {
        let newInstance = new JeygameInternals.Instances[type](true);
        if(properties) {
            for (const [property, value] of Object.entries(properties)) {
                if(property && value) {
                    newInstance[property] = value;
                }
            }
        }
        return newInstance;
    } else {
        throw new Error("Invalid instance");
    }
}

Jeygame.Init = function(size, appendTo = null) {
    let newCanvas = document.createElement("canvas");
    newCanvas.width = size.x;
    newCanvas.height = size.y;

    let game = Jeygame.Make("GameController");
    game.setRenderingCanvas(newCanvas);
    game.addChild(Jeygame.Make("Sprite"));

    if(appendTo) {
        appendTo.append(newCanvas);
    }
    return {
        "Canvas": newCanvas,
        "Game": game,
        "CTX": game.renderContext.ctx
    }
}       

Jeygame.Vector2 = function(x,y,mag = 0) {
    let returnVector = new JeygameInternals.Datatypes.Vector2(x,y,mag);
    return returnVector;
}
Jeygame.RenderContext = function(canvas) {
    let context = new JeygameInternals.Datatypes.RenderContext(canvas);
    return context;
}

Jeygame.Enum = {};
Jeygame.Enum.BoundType = {
    "Rectangle": {"type": "rect", "id": 1},
    "Circle": {"type": "circ", "id": 2}
}