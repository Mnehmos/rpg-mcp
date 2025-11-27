/**
 * Min-heap implementation for efficient priority queue operations in A* pathfinding.
 * Provides O(log n) insert and extract-min operations.
 */
export class MinHeap<T> {
    private heap: Array<{ item: T; priority: number }> = [];
    private itemMap: Map<string, number> = new Map(); // Maps stringified item to index

    constructor(private keyFn: (item: T) => string) { }

    /**
     * Insert an item with a given priority.
     * Time complexity: O(log n)
     */
    insert(item: T, priority: number): void {
        const key = this.keyFn(item);

        // If item already exists, update its priority
        if (this.itemMap.has(key)) {
            this.decreaseKey(item, priority);
            return;
        }

        this.heap.push({ item, priority });
        const index = this.heap.length - 1;
        this.itemMap.set(key, index);
        this.bubbleUp(index);
    }

    /**
     * Extract and return the item with minimum priority.
     * Time complexity: O(log n)
     */
    extractMin(): T | null {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) {
            const { item } = this.heap.pop()!;
            this.itemMap.clear();
            return item;
        }

        const min = this.heap[0];
        const last = this.heap.pop()!;
        this.heap[0] = last;

        this.itemMap.delete(this.keyFn(min.item));
        this.itemMap.set(this.keyFn(last.item), 0);

        this.bubbleDown(0);
        return min.item;
    }

    /**
     * Decrease the priority of an existing item.
     * Time complexity: O(log n)
     */
    decreaseKey(item: T, newPriority: number): void {
        const key = this.keyFn(item);
        const index = this.itemMap.get(key);

        if (index === undefined) return;

        const oldPriority = this.heap[index].priority;
        if (newPriority >= oldPriority) return; // Only decrease, not increase

        this.heap[index].priority = newPriority;
        this.bubbleUp(index);
    }

    /**
     * Check if the heap is empty.
     */
    isEmpty(): boolean {
        return this.heap.length === 0;
    }

    /**
     * Get the current size of the heap.
     */
    size(): number {
        return this.heap.length;
    }

    /**
     * Bubble up an item to maintain heap property.
     */
    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);

            if (this.heap[index].priority >= this.heap[parentIndex].priority) {
                break;
            }

            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    /**
     * Bubble down an item to maintain heap property.
     */
    private bubbleDown(index: number): void {
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < this.heap.length &&
                this.heap[leftChild].priority < this.heap[smallest].priority) {
                smallest = leftChild;
            }

            if (rightChild < this.heap.length &&
                this.heap[rightChild].priority < this.heap[smallest].priority) {
                smallest = rightChild;
            }

            if (smallest === index) break;

            this.swap(index, smallest);
            index = smallest;
        }
    }

    /**
     * Swap two elements in the heap and update the item map.
     */
    private swap(i: number, j: number): void {
        const temp = this.heap[i];
        this.heap[i] = this.heap[j];
        this.heap[j] = temp;

        this.itemMap.set(this.keyFn(this.heap[i].item), i);
        this.itemMap.set(this.keyFn(this.heap[j].item), j);
    }
}
