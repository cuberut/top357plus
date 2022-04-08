// ==UserScript==
// @name         TOP357+
// @version      0.0.3
// @author       cuberut
// @description  Wspomaganie głosowania
// @include      https://top.radio357.pl/app/polski-top/glosowanie
// @updateURL    https://raw.githubusercontent.com/cuberut/top357plus/main/top357plus.js
// @downloadURL  https://raw.githubusercontent.com/cuberut/top357plus/main/top357plus.js
// @grant        GM_addStyle
// ==/UserScript==

GM_addStyle("div#loadbar { width: 100%; background-color: #ddd;}");
GM_addStyle("div#loading { width: 0%; height: 2rem; background-color: #337AB7; padding: 0.25rem 0.5rem; }");
GM_addStyle("div.tagLog { width: 110px; position: absolute; right: 0; margin-right: 60px; text-align: left; }");
GM_addStyle("div#extraTools label, div#extraTools select { display: inline-block; width: 50%; }");
GM_addStyle("span#infoVisible { display: inline-block; text-align: right; width: 30px; }");
GM_addStyle("div#votes { position: absolute; left: 10px; width: auto; text-align: center; }");
GM_addStyle("div#votedList ol { font-size: small; padding-left: 1.5em; margin-top: 1em; }");
GM_addStyle("div#votedList ol li:hover { text-decoration: line-through; cursor: pointer; }");

const urlSettingsList = 'https://opensheet.elk.sh/1lAXlMeuXmY-QIbGIMFb6PMx3ya6L-pLbOMNf2NKNzvE/settingsList';

const getList = async (url) => {
    const response = await fetch(url);
    const myJson = await response.json();
    return await myJson;
}

const setInfoStatus = (amount) => `<p id="infoStatus">Liczba widocznych utworów: <strong><span id="infoVisible">${amount}</span>/<span>${amount}</span></strong> (<span id="infoPercent">100</span>%)`;

const setCheckOrderAscending = () => `<label class="form-check-label"><input id="orderAscending" type="checkbox" checked>Sortuj alfabetycznie rosnąco</label>`;
const setCheckOrderDescending = () => `<label class="form-check-label"><input id="orderDescending" type="checkbox">Sortuj alfabetycznie malejąco</label>`;

const setCheckOrderByOldest = () => `<label class="form-check-label"><input id="orderByOldest" type="checkbox">Sortuj wg najstarszych</label>`;
const setCheckOrderByNewest = () => `<label class="form-check-label"><input id="orderByNewest" type="checkbox">Sortuj wg najmłodszych</label>`;

const setSelectByYears = () => `<label class="form-check-label">Pokaż tylko utwory z lat:</label><select id="chooseByYears"></select>`;

const getTagYearLog = (year) => {
    return `<div class="chart-item__info tagLog"><span>Rok wydania: ${year}</span></div>`
};

let extraTools, amountAll, infoVisible, infoPercent;

const addInfoStatus = () => {
    voteList.insertAdjacentHTML('afterbegin', `<div id="extraTools"></div>`);
    extraTools = voteList.querySelector('#extraTools');

    amountAll = mainList.length;

    extraTools.insertAdjacentHTML('beforeend', setInfoStatus(amountAll));
    const infoStatus = extraTools.querySelector('#infoStatus');

    infoVisible = infoStatus.querySelector('#infoVisible');
    infoPercent = infoStatus.querySelector('#infoPercent');
}

const changeInfoStatus = () => {
    const amountVisible = voteList.querySelectorAll('.list-group-item:not([hidden])').length;
    infoVisible.innerText = amountVisible;

    if (amountVisible == amountAll) {
        infoPercent.innerText = 100;
    } else if (amountVisible == 0) {
        infoPercent.innerText = 0;
    } else {
        const amountPercent = amountVisible / amountAll * 100;
        infoPercent.innerText = amountPercent.toFixed(0);
    }
}

const setOrder = (element, rest, dic) => {
    element.onclick = (e) => {
        resetSelectors();
        const checked = e.target.checked;
        dic.forEach(index => { listGroup.append(itemList[index])});
        rest.forEach(x => { x.checked = false });
        changeInfoStatus();
    }
}

let checkboxes;

const addCheckboxes = (setList) => {
    extraTools.insertAdjacentHTML('beforeend', `<p id="checkboxes"></p>`);
    checkboxes = voteList.querySelector("#checkboxes");

    checkboxes.insertAdjacentHTML('beforeend', setCheckOrderAscending());
    const orderAscending = checkboxes.querySelector("#orderAscending");
    const dicAscending = [...setList].map(item => item.no);

    checkboxes.insertAdjacentHTML('beforeend', setCheckOrderByOldest());
    const orderByOldest = checkboxes.querySelector("#orderByOldest");
    const dicByOldest = [...setList].sort((a, b) => (a.year < b.year) ? -1 : 1).map(item => item.no);

    checkboxes.insertAdjacentHTML('beforeend', setCheckOrderDescending());
    const orderDescending = checkboxes.querySelector("#orderDescending");
    const dicDescending = [...setList].map(item => item.no).reverse();

    checkboxes.insertAdjacentHTML('beforeend', setCheckOrderByNewest());
    const orderByNewest = checkboxes.querySelector("#orderByNewest");
    const dicByNewest = [...setList].sort((a, b) => (a.year > b.year) ? -1 : 1).map(item => item.no);

    setOrder(orderAscending, [orderDescending, orderByOldest, orderByNewest], dicAscending);
    setOrder(orderDescending, [orderAscending, orderByOldest, orderByNewest], dicDescending);
    setOrder(orderByOldest, [orderAscending, orderDescending, orderByNewest], dicByOldest);
    setOrder(orderByNewest, [orderAscending, orderDescending, orderByOldest], dicByNewest);
}

const years = { "0": {list:[], name: "NIEPRZYPISANE"} }

const setOptions = (dic) => Object.keys(dic)
    .filter(key => dic[key].list.length)
    .reduce((options, key) => `${options}<option value=${key}>${dic[key].name} (${dic[key].list.length})</option>`, "<option value=''>Wybierz...</option>");

const setSelector = (element, keys) => {
    element.onchange = (e) => {
        const value = e.target.value;
        mainList.forEach((item, i) => { item.hidden = keys[value] ? !keys[value].list.includes(item.querySelector('input').value) : false });
        changeInfoStatus();
    }
}


let selectors;

const addSelectors = (setList) => {
    extraTools.insertAdjacentHTML('beforeend', `<p id="selectors"></p>`);
    selectors = voteList.querySelector("#selectors");

    selectors.insertAdjacentHTML('beforeend', setSelectByYears());
    const chooseByYears = selectors.querySelector("#chooseByYears");
    chooseByYears.insertAdjacentHTML('beforeend', setOptions(years));

    setSelector(chooseByYears, years);
}

const resetSelectors = () => selectors.querySelectorAll('select').forEach(select => { select.value = "" });

let voteList, listGroup, mainList, itemList;
let listVoted, listBet, listOld;

const addTags = (setList) => {
    voteList = document.querySelector('.vote-list')
    listGroup = voteList.querySelector('ul.list-group');
    mainList = voteList.querySelectorAll(".list-group-item");
    itemList = [...mainList];

    setList.forEach((item, i) => {
        const {year, years, vote} = item;
        const element = mainList[i].querySelector('.vote-item');

        if (year) {
            const tagYear = getTagYearLog(year);
            element.insertAdjacentHTML('beforeend', tagYear);
        }

        if (vote) {
            element.querySelector('input')?.click();
        }
    });

    listVoted = setList.reduce((list, item, i) => item.votes ? [...list, i] : list, []);

    setList.forEach((item, i) => {
        if (!item.years) {
            years.xx.list.push(i);
            return;
        }

        const yearsKeys = Object.keys(years);
        const isYearsKey = yearsKeys.includes(item.years);

        if (!isYearsKey) {
            years[item.years] = { list: [item.id], name: item.years + "-" + item.years.substr(0, 3) + "9" };
        } else {
            years[item.years].list.push(item.id);
        }
    });

    addInfoStatus();
    addCheckboxes(setList);
    addSelectors(setList);
}

const showScroll = (state) => { document.body.style.overflow = state ? 'auto' : 'hidden' }
const toggleVisibility = (element) => { element.style.opacity = (element.style.opacity === '') ? 0 : '' }

const setSearch = (voteList, items) => {
    const searchSection = voteList.querySelector('.vote-list__search');

    if (!searchSection) return;

    searchSection.querySelector('#search').hidden = true;
    searchSection.insertAdjacentHTML('afterbegin', `<input id="searchCustom" name="search" type="text" placeholder="Filtruj" class="form-control">`);
    const searchCustom = searchSection.querySelector('#searchCustom');

    const listElement = items.map(item => ({
        element: item,
        author: item.querySelector('.vote-item__author').innerText.toLowerCase(),
        title: item.querySelector('.vote-item__title').innerText.toLowerCase()
    }));

    searchCustom.addEventListener('change', (e) => {
        const value = e.target.value.toLowerCase();
        listElement.map(item => {
            item.element.hidden = !(item.author.includes(value) || item.title.includes(value));
        });
    });
}

const getVotes = (setList) => {
    const myVotes = {};
    const votes = JSON.parse(localStorage.getItem("myTopVotes"));

    if (votes) {
        votes.forEach(id => { myVotes[id] = true });
        setList.forEach(item => { item.vote = myVotes[item.id] });
    }
}

const setVotes = () => {
    const voteContent = document.querySelector('.vote__content');

    if (voteContent) {
        const voteButton = voteContent.querySelector('button');
        voteButton.addEventListener('click', (e) => {
            extraTools.hidden = true;

            const voteList = document.querySelector('.vote-list');
            const votedItems = [...voteList.querySelectorAll('.vote-item input:checked')];
            const votedList = votedItems.map(elem => +elem.value);

            localStorage.setItem("myTopVotes", JSON.stringify(votedList));
        });
    }
}

const setVoteSection = () => {
    const voteSection = document.querySelector('.layout__action');

    if (voteSection) {
        voteSection.insertAdjacentHTML('beforeend', `<div id="votedList"><ol></ol></div>`);
        const votedList = voteSection.querySelector('#votedList ol');

        const voteCounter = voteSection.querySelector('.vote__votes');
        voteCounter.addEventListener("DOMSubtreeModified", (e) => {
            const checkedItems = voteList.querySelectorAll('ul.list-group input[type="checkbox"]:checked')
            const list = [...checkedItems].reduce((list, item) => {
                const id = item.id;
                const song = item.parentElement.lastChild.innerText.replace("\n", " - ");
                return `${list}<li for="${id}">${song}</li>`;
            }, "");

            votedList.textContent = null
            votedList.insertAdjacentHTML('beforeend', list);

            const votedItems = [...voteSection.querySelectorAll('li')];
            votedItems.forEach(li => {
                li.addEventListener("click", (e) => {
                    const forId = e.target.getAttribute("for");
                    const input = voteList.querySelector(`#${forId}`);
                    input.click();
                });
            });
        }, false);
    }
}

(function() {
    showScroll(false);

    getList(urlSettingsList).then(setList => {
        const setCounter = setList.length;

        let voteList, listNo;
        let loadbar, loading, progress;
        let items = [];
        let itemsCounter = 0;
        let visible;

        const interval = setInterval(() => {
            if (!voteList) {
                voteList = document.querySelector('.vote-list');
            }

            if (voteList && !loading) {
                toggleVisibility(voteList);

                listNo = document.querySelector('.header__heading-voting').innerText.split('#')[1];
                getVotes(setList);
                setVotes();

                voteList.insertAdjacentHTML('beforebegin', `<div id="loadbar"><div id="loading">Zaczytywanie danych...</div></div>`);
                loading = voteList.parentElement.querySelector("#loading");
            }

            if (loading) {
                visible = voteList.querySelectorAll('.list-group-item:not([hidden])');

                if (visible.length || itemsCounter == setCounter) {
                    setTimeout(function(){
                        visible.forEach(item => {
                            item.hidden = true;

                            if (!item.counted) {
                                itemsCounter++;
                                item.counted = true;
                            }
                        });
                    }, 0);

                    items = [...items, ...visible];
                    progress = (itemsCounter/setCounter) * 100;
                    loading.style.width = progress + '%';

                    if (itemsCounter == setCounter) {
                        setSearch(voteList, items);
                        clearInterval(interval);
                        items.forEach(item => { item.hidden = false });
                        showScroll(true);
                        addTags(setList);
                        setVoteSection();
                        loading.hidden = true;
                        toggleVisibility(voteList);
                    }
                }
            }
        }, 25);
    });
})();
