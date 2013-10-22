test:
	@./node_modules/.bin/promises-aplus-tests ./test/aplus_adapter.js --reporter spec
	@./node_modules/.bin/mocha --require should --reporter spec

.PHONY: test