import 'server-only';

// A public release identifier, never credentials. Capture this in the page at
// render time; the independently refreshed API can then report a newer release.
export function productionRelease(){
 return process.env.NEXT_PUBLIC_STRIK_RELEASE || 'development';
}
