/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { EventEmitter } from "events";
import { DataObject, DataObjectFactory } from "@fluidframework/aqueduct";
import { IValueChanged, SharedMap } from "@fluidframework/map";
import { IFluidHandle } from "@fluidframework/core-interfaces";
import { util } from "jointjs";

/**
 * IGraphDataObject describes the public API surface for our graph data object.
 */
export interface IGraphDataObject extends EventEmitter {

    cells: SharedMap;
    users: SharedMap;

    userId: string;

    on(event: string, listener: (id: string, attributes: any) => void): this;
    on(event: string, listener: (id: string, attributes: any, prevAttributes: any) => void): this;

    setCell(id: string, attributes: any): void;

    deleteCell(id: string): void;

    updateUser(attributes: any): void;
}

export interface IUser {
    id: string;
    name: string;
    color: string;
    x?: number;
    y?: number;
    selection?: string;
}

export const initialCells = [{
    size: { width: 100, height: 100 },
    position: { x: 10, y: 10 },
    type: 'devs.Model',
    inPorts: ['in1'],
    outPorts: ['out1', 'out2']
}, {
    size: { width: 100, height: 100 },
    position: { x: 210, y: 210 },
    type: 'devs.Model',
    outPorts: ['out1', 'out2'],
    inPorts: ['in1']
}];

/**
 * The GraphDataObject is our data object that implements the IGraphDataObject interface.
 */
export class GraphDataObject extends DataObject implements IGraphDataObject {

    /**
     * initializingFirstTime is run only once by the first client to create the DataObject.  Here we use it to
     * initialize the state of the DataObject.
     */

    private _cells: SharedMap;
    private _users: SharedMap;

    protected async initializingFirstTime() {

        const cellsMap = SharedMap.create(this.runtime);
        const usersMap = SharedMap.create(this.runtime);

        this.root.set('cellsMap', cellsMap.handle);
        this.root.set('usersMap', usersMap.handle);

        await this.initMaps();
        initialCells.forEach(cell => {
            const id  = util.uuid();
            this.setCell(id, { ...cell, id });
        });
    }

    /**
     * hasInitialized is run by each client as they load the DataObject.  Here we use it to set up usage of the
     * DataObject, by registering an event listener for graph data object.
     */
    protected async hasInitialized() {

        await this.initMaps();

        this.cells.on('valueChanged', (changed: IValueChanged) => {
            this.emit('cellChanged', changed.key, this.cells.get(changed.key));
        });

        this.users.on('valueChanged', (changed: IValueChanged) => {
            this.emit('userChanged', changed.key, this.users.get(changed.key), changed.previousValue);
        });

        this.addUser();
    }

    private async initMaps() {
        if (!this._cells) {
            const mapHandle =  this.root.get<IFluidHandle<SharedMap>>('cellsMap');
            if (!mapHandle) throw Error('Something went wrong');
            this._cells = await mapHandle.get();
        }
        if (!this._users) {
            const mapHandle =  this.root.get<IFluidHandle<SharedMap>>('usersMap');
            if (!mapHandle) throw Error('Something went wrong');
            this._users = await mapHandle.get();
        }
    }

    public get cells() {
        return this._cells;
    }

    public get users() {
        return this._users;
    }

    public setCell(id: string, attributes: any) {
        this.cells.set(id, attributes);
    }

    public deleteCell(id: string) {
        if (this.cells.has(id)) {
            this.cells.delete(id);
        }
    }

    public userId: string;

    public addUser() {
        if (
            sessionStorage.getItem("userId") && this.users.get<IUser>(<string>sessionStorage.getItem("userId"))
          ) {
            this.userId = <string>sessionStorage.getItem("userId"); //This session might have has a user
          } else {
            const user: IUser = {
              id: util.uuid(),
              name: 'Fake',
              color: getRandomColor()
            };
            this.userId = user.id;
            sessionStorage.setItem("userId", user.id);
            this.users.set(user.id, user);
          }
    }

    public getUser(): IUser | undefined {
        return this.users.get<IUser>(this.userId);
    }

    public updateUser(attributes: any) {
        return this.users.set(this.userId, { ...this.getUser(), ...attributes });
    }
}

function getRandomColor(): string {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

/**
 * The DataObjectFactory is used by Fluid Framework to instantiate our DataObject.  We provide it with a unique name
 * and the constructor it will call.  In this scenario, the third and fourth arguments are not used.
 */
export const GraphDataObjectInstantiationFactory = new DataObjectFactory(
    "graph-data-object",
    GraphDataObject,
    [],
    {},
);
