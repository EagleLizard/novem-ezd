
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

(async () => {
  try {
    await main();
  } catch(e) {
    console.error(e);
    throw e;
  }
})();

async function main() {
  console.log('~ hey');
}
