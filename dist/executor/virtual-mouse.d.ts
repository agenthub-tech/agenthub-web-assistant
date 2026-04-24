export declare class VirtualMouse {
    private cursor;
    private isAnimating;
    private queue;
    private ensureCursor;
    private animate;
    moveTo(x: number, y: number): void;
    show(): void;
    remove(): void;
}
