(function bootV2ChecklistEnhancements() {
	const EXTENSIONS = [
		'tasks.v2.component.elements.growing-text-area',
		'tasks.v2.component.fields.check-list',
	];
	const STYLE_ID = 'tasks-v2-checklist-autonumbering';

	function getGrowingTextArea() {
		return BX?.Tasks?.V2?.Component?.Elements?.GrowingTextArea || null;
	}

	function getPastedChecklistItems(text) {
		if (typeof text !== 'string')
		{
			return [];
		}

		const listPrefixPattern = /^(([\u2022\u2023\u25E6\u2043\u2219\u25AA\u25CF]|[-*+])\s+|\d+[.)]\s+|[A-Za-z\u0410-\u042F\u0430-\u044F\u0401\u0451][.)]\s+|\[[ xX]\]\s+)/u;
		const lines = text
			.replace(/\r\n?/g, '\n')
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
		;

		if (lines.length < 2)
		{
			return [];
		}

		const shouldTrimListPrefix = lines.every((line) => listPrefixPattern.test(line));

		return lines
			.map((line) => (shouldTrimListPrefix ? line.replace(listPrefixPattern, '').trim() : line))
			.filter(Boolean)
		;
	}

	function findCheckListChildVm(vm) {
		let current = vm?.$parent;

		while (current)
		{
			if (current.$options?.name === 'CheckListChildItem')
			{
				return current.item && current.item.parentId !== 0 ? current : null;
			}

			current = current.$parent;
		}

		return null;
	}

	function findCheckListVm(vm) {
		let current = vm;

		while (current)
		{
			if (
				typeof current.insertManyCheckLists === 'function'
				&& typeof current.upsertCheckLists === 'function'
				&& typeof current.updateTask === 'function'
				&& current.checkListManager
				&& Array.isArray(current.task?.checklist)
			)
			{
				return current;
			}

			current = current.$parent;
		}

		return null;
	}

	async function handleCheckListPaste(event) {
		if (!event?.clipboardData || this.readonly)
		{
			return;
		}

		const itemVm = findCheckListChildVm(this);
		if (!itemVm || itemVm.textReadOnly || itemVm.canAdd === false)
		{
			return;
		}

		const pastedItems = getPastedChecklistItems(event.clipboardData.getData('text/plain') || '');
		if (pastedItems.length === 0)
		{
			return;
		}

		const checkListVm = findCheckListVm(itemVm);
		const textarea = this.$refs?.textarea;

		if (!checkListVm || !textarea)
		{
			return;
		}

		const currentItem = itemVm.item;
		const parentId = currentItem.parentId;
		if (!parentId)
		{
			return;
		}

		event.preventDefault();

		const inputValue = textarea.value || '';
		const selectionStart = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : inputValue.length;
		const selectionEnd = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : inputValue.length;
		const [firstTitle, ...otherTitles] = pastedItems;

		const newValue =
			inputValue.slice(0, selectionStart)
			+ firstTitle
			+ inputValue.slice(selectionEnd)
		;

		textarea.value = newValue;

		const cursorPosition = selectionStart + firstTitle.length;
		textarea.setSelectionRange(cursorPosition, cursorPosition);

		this.$emit('update:modelValue', newValue);
		this.$emit('input', newValue);
		void this.adjustTextareaHeight?.();

		if (otherTitles.length === 0)
		{
			return;
		}

		const insertSort = currentItem.sortIndex + 1;
		const shiftCount = otherTitles.length;
		const parentItem = checkListVm.checkListManager.getItem(parentId);

		const shiftedItems = (checkListVm.checkLists || [])
			.filter((item) => item.parentId === parentId && item.sortIndex >= insertSort)
			.map((item) => ({
				...item,
				sortIndex: item.sortIndex + shiftCount,
			}))
		;

		const newItems = otherTitles.map((title, index) => {
			const id = BX.Text.getRandom();

			return {
				id,
				nodeId: id,
				parentId,
				parentNodeId: parentItem ? parentItem.nodeId : null,
				sortIndex: insertSort + index,
				title,
			};
		});

		if (shiftedItems.length > 0)
		{
			await checkListVm.upsertCheckLists(shiftedItems);
		}

		await checkListVm.insertManyCheckLists(newItems);
		await checkListVm.updateTask({
			checklist: [...checkListVm.task.checklist, ...newItems.map((item) => item.id)],
		});
	}

	function bindPaste(vm) {
		const textarea = vm?.$refs?.textarea;

		if (!textarea || textarea.__v2ChecklistPasteBound)
		{
			return;
		}

		textarea.__v2ChecklistPasteBound = true;
		vm.__v2ChecklistPasteHandler ??= handleCheckListPaste.bind(vm);
		textarea.addEventListener('paste', vm.__v2ChecklistPasteHandler);
	}

	function installAutonumbering() {
		if (document.getElementById(STYLE_ID))
		{
			return;
		}

		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			.check-list-widget-item.--parent > .check-list-widget {
				counter-reset: tasks-v2-checklist-item;
			}

			.check-list-widget-item.--parent > .check-list-widget > .check-list-widget-item .check-list-widget-child-item-title {
				display: flex;
				align-items: flex-start;
				gap: 6px;
			}

			.check-list-widget-item.--parent > .check-list-widget > .check-list-widget-item .check-list-widget-child-item-title::before {
				counter-increment: tasks-v2-checklist-item;
				content: counter(tasks-v2-checklist-item) ".";
				flex: 0 0 auto;
				min-width: 20px;
				color: var(--ui-color-base-4);
				font-size: 15px;
				line-height: 20px;
				font-weight: var(--ui-font-weight-medium);
				text-align: right;
			}

			.check-list-widget-item.--parent > .check-list-widget > .check-list-widget-item .check-list-widget-child-item-title > .b24-growing-text-area,
			.check-list-widget-item.--parent > .check-list-widget > .check-list-widget-item .check-list-widget-child-item-title > .tasks-check-list-formatting-layer-display,
			.check-list-widget-item.--parent > .check-list-widget > .check-list-widget-item .check-list-widget-child-item-title > .b24-growing-text-area-display,
			.check-list-widget-item.--parent > .check-list-widget > .check-list-widget-item .check-list-widget-child-item-title > .b24-growing-text-area-edit {
				flex: 1 1 auto;
				min-width: 0;
			}
		`;

		(document.head || document.documentElement).appendChild(style);
	}

	function installPatch(GrowingTextArea) {
		if (GrowingTextArea.__checkListPastePatched)
		{
			installAutonumbering();
			return;
		}

		GrowingTextArea.__checkListPastePatched = true;
		GrowingTextArea.getPastedChecklistItems = getPastedChecklistItems;

		const originalMounted = GrowingTextArea.mounted;
		GrowingTextArea.mounted = function(...args) {
			const result = originalMounted ? originalMounted.apply(this, args) : undefined;
			bindPaste(this);

			return result;
		};

		const originalFocusTextarea = GrowingTextArea.methods.focusTextarea;
		GrowingTextArea.methods.focusTextarea = function(...args) {
			const result = originalFocusTextarea.apply(this, args);

			this.$nextTick(() => bindPaste(this));

			return result;
		};

		const originalHandleFocus = GrowingTextArea.methods.handleFocus;
		GrowingTextArea.methods.handleFocus = async function(...args) {
			const result = await originalHandleFocus.apply(this, args);
			bindPaste(this);

			return result;
		};

		installAutonumbering();
	}

	function tryInstall(attempt = 0) {
		const GrowingTextArea = getGrowingTextArea();

		if (GrowingTextArea)
		{
			installPatch(GrowingTextArea);
			return;
		}

		if (attempt > 40)
		{
			return;
		}

		if (BX?.Runtime?.loadExtension)
		{
			Promise.allSettled(EXTENSIONS.map((name) => BX.Runtime.loadExtension(name)))
				.finally(() => {
					setTimeout(() => tryInstall(attempt + 1), 250);
				})
			;
		}
		else
		{
			setTimeout(() => tryInstall(attempt + 1), 250);
		}
	}

	if (document.readyState === 'loading')
	{
		document.addEventListener('DOMContentLoaded', () => tryInstall(), { once: true });
	}
	else
	{
		tryInstall();
	}
})();
