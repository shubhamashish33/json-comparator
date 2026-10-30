// CRA's jsdom environment omits the encoding API used by React Router.
import { TextEncoder, TextDecoder } from "util";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
