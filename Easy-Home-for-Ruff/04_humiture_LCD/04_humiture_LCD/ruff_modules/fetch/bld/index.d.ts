import 'promise';
import * as HTTP from 'http';
export interface HashTable<T> {
    [key: string]: T;
}
export declare type HttpMethod = 'GET' | 'POST';
export interface InitOptions {
    method?: HttpMethod;
    headers?: HashTable<string>;
    body?: string | Buffer;
    referrer?: string;
}
export default function fetch(url: string, {method, headers, body, referrer}?: InitOptions): Promise<Response>;
export declare class Response {
    private _res;
    private _headers;
    private _bufferPromise;
    constructor(res: HTTP.IncomingMessage);
    ok: boolean;
    status: number;
    statusText: string;
    headers: HashTable<string>;
    bodyUsed: boolean;
    buffer(): Promise<Buffer>;
    text(): Promise<string>;
    json(): Promise<string>;
}
