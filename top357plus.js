// ==UserScript==
// @name         TOP357+
// @version      0.3.2
// @author       cuberut
// @description  Wspomaganie głosowania
// @match        https://lista.radio357.pl/app/top/glosowanie
// @updateURL    https://raw.githubusercontent.com/cuberut/top357plus/main/top357plus.js
// @downloadURL  https://raw.githubusercontent.com/cuberut/top357plus/main/top357plus.js
// @grant        GM_addStyle
// ==/UserScript==

GM_addStyle("div#loadbar { width: 100%; background-color: #ddd;}");
GM_addStyle("div#loading { width: 0%; height: 2rem; background-color: #337AB7; padding: 0.25rem 0.5rem; }");
GM_addStyle("div.tagNew { position: absolute; right: 0; margin-right: 100px; }");
GM_addStyle("div.tagLog { width: 110px; position: absolute; right: 0; margin-right: 60px; text-align: left; }");
GM_addStyle("div#extraTools label, div#extraTools select { display: inline-block; width: 50%; }");
GM_addStyle("div#extraTools #selectors { width: 50%; padding-right: 1em }");
GM_addStyle("span#infoVisible { display: inline-block; text-align: right; width: 40px; }");
GM_addStyle("div#votes { position: absolute; left: 10px; width: auto; text-align: center; }");
GM_addStyle("div#votedList ol { font-size: small; padding-left: 1.5em; margin-top: 1em; }");
GM_addStyle("div#votedList ol li:hover { text-decoration: line-through; cursor: pointer; }");
GM_addStyle("ul.songGroups .gInfo { border-width: 1px 3px; border-color: #bbb; border-style: solid; cursor: pointer; }");
GM_addStyle("ul.songGroups .gRow { border-width: 0px 3px 1px; }");
GM_addStyle("ul.songGroups .gEnd { border-bottom-width: 3px; }");

const urlApi = 'https://opensheet.elk.sh/1GxtFKaVifd9lTDNCjB65BFSqUl7L6SIprK9OwxZCUno';
const urlSettings = `${urlApi}/settings`;
const urlGroups = `${urlApi}/groups`;

const getList = async (url) => {
    const response = await fetch(url);
    const myJson = await response.json();
    return await myJson;
}

const loadData = (key) => JSON.parse(localStorage.getItem(key));

const changeData = (key, value, isRemoved) => {
    const oldData = loadData(key) || [];
    const newData = isRemoved
        ? oldData.filter(x => x!=value)
        : [...oldData, value];
    localStorage.setItem(key, JSON.stringify(newData));
}

const changeAllData = (key, list) => {
    localStorage.setItem(key, JSON.stringify(list));
}

const setInfoStatus = (amount) => `<p id="infoStatus">Liczba widocznych utworów: <strong><span id="infoVisible">${amount}</span>/<span>${amount}</span></strong> (<span id="infoPercent">100</span>%)`;

const setCheckOnlyIsNew = (amount) => `<label class="form-check-label"><input id="onlyIsNew" type="checkbox" ${amount || 'disabled'}><span>Pokaż tylko nowości - ${amount} pozycji</span></label>`;
const setCheckShrinkAll = (amount) => `<label class="form-check-label"><input id="shrinkAll" type="checkbox" ${amount || 'disabled'}><span>Zwiń wszystkie grupy - ${amount} pozycji</span></label>`;

const setCheckOrderAscending = () => `<label class="form-check-label"><input id="orderAscending" type="checkbox" checked>Sortuj alfabetycznie rosnąco</label>`;
const setCheckOrderDescending = () => `<label class="form-check-label"><input id="orderDescending" type="checkbox">Sortuj alfabetycznie malejąco</label>`;

const setCheckOrderByOldest = () => `<label class="form-check-label"><input id="orderByOldest" type="checkbox">Sortuj wg najstarszych</label>`;
const setCheckOrderByNewest = () => `<label class="form-check-label"><input id="orderByNewest" type="checkbox">Sortuj wg najmłodszych</label>`;

const setSelectByYears = () => `<label class="form-check-label">Pokaż tylko utwory z lat:</label><select id="chooseByYears"></select>`;

const tagNew = '<span class="badge badge-primary tagNew">Nowość!</span>';

const getTagLog = (year, rank) => {
    const yearPart = `<span>Rok wydania: ${year}</span>`;
    const rankPart = rank ? `<span>Ostatnia pozycja: ${rank}</span>` : '';
    return `<div class="chart-item__info tagLog">${yearPart}<br/><br/>${rankPart}</div>`;
};

const getGroupInfo = (group, checked) => {
    return `<i class="icon mr-4 text-muted fas fa-chevron-down"></i><strong>${group.name}</strong> - [<span>0</span>/${group.amount}]`;
}

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
        infoPercent.innerText = Math.floor(amountPercent);
    }
}

const setGroups = () => {
    const dataGroups = loadData('shrinkGroups');
    if (dataGroups) {
        dataGroups.forEach(groupId => {
            dicGroup[groupId].checked = true;
            dicGroup[groupId].rows.forEach(songIndex => { mainList[songIndex].hidden = true });

            dicGroup[groupId].icon.classList.remove('fa-chevron-down');
            dicGroup[groupId].icon.classList.add('fa-chevron-right');
        });
        changeInfoStatus();
    }
}

const setCheckboxOnly = (element, rest, dic) => {
    element.onclick = (e) => {
        const checked = e.target.checked;
        mainList.forEach((item, i) => { item.hidden = !dic[i] && checked });
        rest.forEach(x => { x.checked = false });

        hideGroups(checked);
        changeInfoStatus();
        resetSelectors();
    }
}

const setCheckboxHide = (element, rest) => {
    element.onclick = (e) => {
        const checked = e.target.checked;

        groupedKeys.forEach(key => { dicGroup[key].checked = checked });
        groupedSongs.forEach(song => { song.hidden = checked });
        groupedIcons.forEach(icon => {
            if (checked) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-down');
            }
        });

        changeAllData('shrinkGroups', checked ? groupedKeys : []);
        changeInfoStatus();
        resetSelectors();
    }
}

const setOrder = (element, rest, dic) => {
    element.onclick = (e) => {
        const checked = e.target.checked;

        if (checked) {
            dic.forEach(index => { listGroup.append(itemList[index])});
            rest.forEach(x => { x.checked = false });
        } else {
            element.checked = true;
        }

        hideGroups(checked);
    }
}

let checkboxes1, checkboxes2;

const addCheckboxes = (setList) => {
    extraTools.insertAdjacentHTML('beforeend', `<p id="chb1" class="checkboxes1"></p>`);
    checkboxes1 = voteList.querySelector("#chb1");

    const checkOnlyIsNew = setCheckOnlyIsNew(listIsNew.length);
    checkboxes1.insertAdjacentHTML('beforeend', checkOnlyIsNew);
    const onlyIsNew = checkboxes1.querySelector("#onlyIsNew");
    const dicIsNew = listIsNew.reduce((dic, key) => ({...dic, [key]: true}), {});

    const checkShrinkAll = setCheckShrinkAll(groupedSongKeys.length);
    checkboxes1.insertAdjacentHTML('beforeend', checkShrinkAll);
    const shrinkAll = checkboxes1.querySelector("#shrinkAll");

    setCheckboxOnly(onlyIsNew, [shrinkAll], dicIsNew);
    setCheckboxHide(shrinkAll, [onlyIsNew]);

    extraTools.insertAdjacentHTML('beforeend', `<p id="chb2" id="checkboxes"></p>`);
    checkboxes2 = voteList.querySelector("#chb2");

    const orderList = [...setList].map((item, i) => ({ no: i, year: +item.year }));

    checkboxes2.insertAdjacentHTML('beforeend', setCheckOrderAscending());
    const orderAscending = checkboxes2.querySelector("#orderAscending");
    const dicAscending = orderList.map(item => item.no);

    checkboxes2.insertAdjacentHTML('beforeend', setCheckOrderByOldest());
    const orderByOldest = checkboxes2.querySelector("#orderByOldest");
    const dicByOldest = orderList.sort((a, b) => (a.year < b.year) ? -1 : 1).map(item => item.no);

    checkboxes2.insertAdjacentHTML('beforeend', setCheckOrderDescending());
    const orderDescending = checkboxes2.querySelector("#orderDescending");
    const dicDescending = [...dicAscending].reverse();

    checkboxes2.insertAdjacentHTML('beforeend', setCheckOrderByNewest());
    const orderByNewest = checkboxes2.querySelector("#orderByNewest");
    const dicByNewest = orderList.sort((a, b) => (a.year > b.year) ? -1 : 1).map(item => item.no);

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
        shrinkAll(!!value);
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
let listIsNew, listVoted;
let dicGroup = {}, dicGroupSong = {};
let groupedKeys, groupedSongKeys;
let groupedList, groupedIcons, groupedSongs = [];

const addTags = (setList) => {
    voteList = document.querySelector('.vote-list')
    listGroup = voteList.querySelector('ul.list-group');
    mainList = voteList.querySelectorAll(".list-group-item");
    itemList = [...mainList];

    setList.forEach((item, i) => {
        const {id, isNew, lastP, year, years, vote, groupId} = item;
        const element = mainList[i].querySelector('.vote-item');
        const label = element.querySelector('label');

        if (isNew) {
            label.insertAdjacentHTML('afterend', tagNew);
        }

        const tagYear = getTagLog(year, lastP);
        element.insertAdjacentHTML('beforeend', tagYear);

        if (vote) {
            element.querySelector('input')?.click();
        }

        if (groupId) {
            const song = mainList[i];
            if (dicGroup[groupId]) {
                dicGroup[groupId].rows.push(i);
                dicGroup[groupId].songs.push(song);
            } else {
                dicGroup[groupId] = { checked: false, rows: [i], songs: [song] }
            }
            dicGroupSong[id] = groupId;
            groupedSongs.push(song);
        }
    });

    groupedKeys = Object.keys(dicGroup);
    groupedSongKeys = Object.keys(dicGroupSong);

    listIsNew = setList.reduce((list, item, i) => item.isNew ? [...list, i] : list, []);
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

const addGroups = (loading) => {
    getList(urlGroups).then(groupList => {
        listGroup.classList.toggle('songGroups');
        groupList.forEach(group => {
            dicGroup[group.id].rows.forEach((row, i) => {
                const button = mainList[row];
                button.classList.add("gRow");
                if (i == 0) {
                    const groupDiv = document.createElement('div');
                    groupDiv.id = `g-${group.id}`;
                    groupDiv.classList.add('gInfo');
                    groupDiv.insertAdjacentHTML('afterbegin', getGroupInfo(group, 0));

                    groupDiv.onclick = (e) => {
                        const clickedGroup = e.currentTarget;
                        clickedGroup.classList.toggle("gEnd");

                        dicGroup[group.id].icon.classList.toggle('fa-chevron-right');
                        dicGroup[group.id].icon.classList.toggle('fa-chevron-down');

                        let votedCounter = 0;
                        const checked = dicGroup[group.id].checked;
                        dicGroup[group.id].rows.forEach(rowId => {
                            mainList[rowId].hidden = !checked;

                            const input = mainList[rowId].querySelector('input[type="checkbox"]');

                            if (input.checked) {
                                votedCounter++;
                            }
                        });
                        dicGroup[group.id].checked = !checked;

                        const votedValue = clickedGroup.querySelector('span');
                        votedValue.textContent = votedCounter;
                        changeData('shrinkGroups', group.id, checked);
                        changeInfoStatus();
                    }
                    listGroup.insertBefore(groupDiv, button);
                    dicGroup[group.id].icon = groupDiv.firstChild;
                } else if (i == group.amount-1) {
                    button.classList.add("gEnd");
                }

                const input = mainList[row].querySelector('input[type="checkbox"]');
                input.onclick = (e) => {
                    const checked = e.target.checked;
                    const songId = e.target.value;
                    const id = dicGroupSong[songId];
                    const groupDiv = listGroup.querySelector(`div#g-${id}`);
                    const votedValue = groupDiv.querySelector('span');
                    if (checked) {
                        votedValue.textContent++;
                    } else {
                        votedValue.textContent--;
                    }
                }
            });
        });
        groupedList = listGroup.querySelectorAll("div.gInfo");
        groupedIcons = listGroup.querySelectorAll("i");
        setGroups();
        loading.hidden = true;
        toggleVisibility(voteList);
    });
}

const hideGroups = (state) => {
    groupedList.forEach(group => { group.hidden = state });

    if (state) {
        listGroup.classList.remove('songGroups');
    } else {
        listGroup.classList.add('songGroups');
        setGroups();
    }
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
                const songElement = item.parentElement.querySelector('label');
                const songValue = songElement.innerText.replace("\n", " - ");
                return `${list}<li for="${id}">${songValue}</li>`;
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

    getList(urlSettings).then(setList => {
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
                        addGroups(loading);
                    }
                }
            }
        }, 25);
    });
})();
