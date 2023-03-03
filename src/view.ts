import { dia, shapes, V, Vectorizer, highlighters } from "jointjs";
import { IGraphDataObject, initialCells,IUser } from "./dataObject";

export function renderPaper(graphDataObject: IGraphDataObject, div: HTMLDivElement) {

    const stencilEl = document.createElement('div');
    stencilEl.className = 'component';
    stencilEl.draggable = true;
    stencilEl.style.width = '100px';
    stencilEl.style.height = '100px';
    stencilEl.style.display = 'inline-block';
    stencilEl.textContent = 'Model';
    stencilEl.style.border = '1px solid black';
    div.append(stencilEl);

    const paperEl = document.createElement('div');
    const graph = new dia.Graph({}, { cellNamespace: shapes });
    const paper = new dia.Paper({
        el: paperEl,
        model: graph,
        width: 1000,
        height: 500,
        frozen: true,
        async: true,
        sorting: dia.Paper.sorting.APPROX,
        cellViewNamespace: shapes,
        defaultLink: () => new shapes.standard.Link
    });
    paper.el.style.border = '1px solid gray';
    div.append(paperEl);
    paper.unfreeze();

    paper.on('element:pointerdblclick', elementView => elementView.model.remove());

    paper.el.addEventListener('drop', function(evt: any) {
        const [cell] = initialCells;
        graph.addCell(({
            ...cell,
            position: paper.clientToLocalPoint(evt.clientX - 50, evt.clientY - 50).toJSON()
          }) as any);
      }, false);

    // necessary for the drop event to trigger
    paper.el.addEventListener('dragover', function (evt: dia.Event) {
        evt.preventDefault();
    }, false);

    const updateCell = (id: string, attributes: any) => {
        const cell = graph.getCell(id);
        if (cell) {
            if (attributes) {
                cell.set(attributes);
            } else {
                cell.remove();
            }
        } else {
            if (!attributes) return;
            graph.addCell(attributes);
        }
    };

    graphDataObject.cells.forEach(cell => updateCell(cell.id, cell));

    graphDataObject.on('cellChanged', updateCell);

    graph.on('change add', function(cell) {
        if (cell === graph) return;
        graphDataObject.setCell(cell.id, cell.attributes);
    });

    graph.on('remove', function(cell) {
        graphDataObject.deleteCell(cell.id);
    });

    const remoteCursors: { [userId: string]: Vectorizer } = {};

    graphDataObject.on('userChanged', function(id: string, user: IUser, previous: IUser) {
        if (user.selection) {
            const cell = graph.getCell(user.selection);
            if (cell) {
                const cellView = cell.findView(paper);
                if (!highlighters.mask.get(cellView, 'selection')) {
                    highlighters.mask.add(cellView, 'root', 'selection', {
                        deep: true,
                        attrs: {
                            'stroke': user.color,
                            'stroke-width': 3
                        }
                    });
                }
            }
        }

        if (previous.selection && previous.selection !== user.selection) {
            const cell = graph.getCell(previous.selection);
            if (cell) {
                const cellView = cell.findView(paper);
                highlighters.mask.remove(cellView);
            }
        }

        if (id === graphDataObject.userId) return;
        let circle: Vectorizer;
        if (!remoteCursors[id]) {
            circle = V('circle').attr({ 'r': 5, 'pointer-events': 'none' });
            circle.appendTo(paper.layers);
            remoteCursors[id] = circle;
        } else {
            circle = remoteCursors[id];
        }
        circle.attr({ 'cx': user.x || 0, 'cy': user.y || 0, 'fill': user.color });
    });

    paper.$el.on('mousemove', (evt: any) => {
        const point = paper.clientToLocalPoint(evt.clientX, evt.clientY);
        graphDataObject.updateUser(point.toJSON());
    });

    paper.on('cell:pointerclick', function(cellView) {
        graphDataObject.updateUser({ selection: cellView.model.id });
    });

    paper.on('blank:pointerclick', function(cellView) {
        graphDataObject.updateUser({ selection: '' });
    });
}
