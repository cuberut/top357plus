// ==UserScript==
// @name         TOP357+
// @version      0.9
// @author       cuberut
// @description  Wspomaganie głosowania
// @match        https://glosuj.radio357.pl/app/polski-top/glosowanie
// @updateURL    https://raw.githubusercontent.com/cuberut/top357plus/main/top357plus.js
// @downloadURL  https://raw.githubusercontent.com/cuberut/top357plus/main/top357plus.js
// @require      https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js
// @resource     REMOTE_CSS https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

const myCss = GM_getResourceText("REMOTE_CSS");
GM_addStyle(myCss);
GM_addStyle("div.ct-chart { background-color: white; opacity: 95% }");
GM_addStyle("div.ct-chart g.ct-grids line[y1='330'] { stroke-dasharray: 8; stroke-width: 2; }");
GM_addStyle("div.ct-chart g.ct-series-a .ct-line { stroke: #f95f1f }");
GM_addStyle("div.ct-chart g.ct-series-a .ct-point { stroke: #f95f1f; fill: #f95f1f; }");
GM_addStyle("div.tagNew { position: absolute; right: 0; margin-right: 100px; }");
GM_addStyle("div.tagLog { width: 110px; position: absolute; right: 0; margin-right: 60px; text-align: left; }");
GM_addStyle("div#extraTools { display: flex; flex-wrap: wrap; justify-content: space-between; margin-bottom: 0.5em }");
GM_addStyle("div#extraTools > p { width: 100% }");
GM_addStyle("div#extraTools > div { width: 50%; box-sizing: border-box; }");
GM_addStyle("span#infoVisible { display: inline-block; text-align: right; width: 40px; }");
GM_addStyle("div#averageYear { margin: 0px -20px 10px }");
GM_addStyle("div#votes { position: absolute; left: 10px; width: auto; text-align: center; }");
GM_addStyle("div#votedList { box-sizing: border-box; max-height: 650px; overflow-x: auto; white-space: nowrap; }");
GM_addStyle("div#votedList ol { font-size: small; padding-left: 2em; margin-top: 1em; }");
GM_addStyle("div#votedList ol li:hover { text-decoration: line-through; cursor: pointer; }");
GM_addStyle("ul.songGroups .gInfo { border-width: 1px 3px; border-color: #bbb; border-style: solid; cursor: pointer; }");
GM_addStyle("ul.songGroups .gRow { border-width: 0px 3px 1px; }");
GM_addStyle("ul.songGroups .gEnd { border-bottom-width: 3px; }");

const urlApi = 'https://opensheet.elk.sh/1pWopWnJ9Gogfv7U3_2QWoHFLtFv7CTLli3hLKe_BcvQ/';
const urlSettings = `${urlApi}/settings`;
const urlGroups = `${urlApi}/groups`;

const topType = window.location.pathname.split('/')[2];
const currentYear = new Date().getFullYear();
const topYear = currentYear + (topType == "top" ? 1 : 0);
const storageName = 'shrinkGroups' + topYear + topType;

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

const setCheckOnlyIsNew = (amount) => `<input id="onlyIsNew" type="checkbox" class="custom-check custom-checkbox" ${amount || 'disabled'}><label for="onlyIsNew"><span>Pokaż tylko nowości - ${amount} pozycji</span></label>`;
const setCheckShrinkAll = (amount) => `<input id="shrinkAll" type="checkbox" class="custom-check custom-checkbox" ${amount || 'disabled'}><label for="shrinkAll"><span>Zwiń wszystkie grupy - ${amount} pozycji</span></label>`;
const setCheckOnlyRanked = (amount) => `<input id="onlyRanked" type="checkbox" class="custom-check custom-checkbox" ${amount || 'disabled'}><label for="onlyRanked"><span>Pokaż tylko notowane - ${amount} pozycji</span></label>`;

const setSelectByYears = () => `<label class="form-check-label">Pokaż tylko utwory z lat:</label>&#11;<select id="chooseByYears"></select>`;

const tagNew = '<span class="badge badge-primary tagNew">Nowość!</span>';

const getTagLog = (year, rank, change) => {
    const yearPart = `<span>rok wydania: ${year}</span>`;
    const rankPart = rank ? `<span>ostatnia poz.: ${rank}` + (change ? ` (${change})` : '') + `</span>` : '';
    return `<div class="chart-item__info tagLog">${yearPart}<br/><br/>${rankPart}</div>`;
};

const getGroupInfo = (group, checked) => {
    return `<i class="icon mr-4 text-muted fas fa-chevron-down"></i><strong>${group.name}</strong> - [<span>${group.counter}</span>/${group.amount}]`;
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
    const dataGroups = loadData(storageName);
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
        Object.entries(itemDict).forEach(([id, item]) => { item.hidden = !dic[id] && checked });
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

        changeAllData(storageName, checked ? groupedKeys : []);
        changeInfoStatus();
        resetSelectors();
    }
}

const addCheckboxes = (setList) => {
    extraTools.insertAdjacentHTML('beforeend', `<div id="chb1"></div>`);
    extraTools.insertAdjacentHTML('beforeend', `<div id="chb2"></div>`);
    extraTools.insertAdjacentHTML('beforeend', `<div id="chb3"></div>`);

    const checkboxes1 = voteList.querySelector("#chb1");
    const checkboxes2 = voteList.querySelector("#chb2");
    const checkboxes3 = voteList.querySelector("#chb3");

    const checkOnlyIsNew = setCheckOnlyIsNew(listIsNew.length);
    checkboxes1.insertAdjacentHTML('beforeend', checkOnlyIsNew);
    const onlyIsNew = checkboxes1.querySelector("#onlyIsNew");
    const dicIsNew = listIsNew.reduce((dic, key) => ({...dic, [key]: true}), {});

    const checkShrinkAll = setCheckShrinkAll(groupedSongKeys.length);
    checkboxes2.insertAdjacentHTML('beforeend', checkShrinkAll);
    const shrinkAll = checkboxes2.querySelector("#shrinkAll");

    const checkOnlyRanked = setCheckOnlyRanked(listRanked.length);
    checkboxes3.insertAdjacentHTML('beforeend', checkOnlyRanked);
    const onlyRanked = checkboxes3.querySelector("#onlyRanked");
    const dicRanked = listRanked.reduce((dic, key) => ({...dic, [key]: true}), {});

    setCheckboxOnly(onlyIsNew, [shrinkAll, onlyRanked], dicIsNew);
    setCheckboxHide(shrinkAll, [onlyIsNew, onlyRanked]);
    setCheckboxOnly(onlyRanked, [onlyIsNew, shrinkAll], dicRanked);
}

const years = { "0": {list:[], name: "NIEPRZYPISANE"} }
const setOptions = (dic) => Object.keys(dic)
    .filter(key => dic[key].list.length)
    .reduce((options, key) => `${options}<option value=${key}>${dic[key].name} (${dic[key].list.length})</option>`, "<option value=''>Wybierz...</option>");

const setSelector = (element, keys) => {
    element.onchange = (e) => {
        const value = e.target.value;
        mainList.forEach((item, i) => { item.hidden = keys[value] ? !keys[value].list.includes(item.querySelector('input').value) : false });
        hideGroups(!!value);
        changeInfoStatus();
    }
}

let selectors;

const addSelectors = (setList) => {
    extraTools.insertAdjacentHTML('beforeend', `<div id="selectors"></div>`);
    selectors = voteList.querySelector("#selectors");

    selectors.insertAdjacentHTML('beforeend', setSelectByYears());
    const chooseByYears = selectors.querySelector("#chooseByYears");
    chooseByYears.insertAdjacentHTML('beforeend', setOptions(years));

    setSelector(chooseByYears, years);
}

const resetSelectors = () => selectors.querySelectorAll('select').forEach(select => { select.value = "" });

let voteList, listGroup, mainList, itemDict;
let listIsNew, listRanked, listVoted, votedList;
let dicYear = {}, dicGroup = {}, dicGroupSong = {};
let groupedKeys, groupedSongKeys;
let groupedList, groupedIcons, groupedSongs = [];

const addTags = (listNo, setList) => {
    voteList = document.querySelector('.vote-list')
    listGroup = voteList.querySelector('ul.list-group');
    mainList = [...voteList.querySelectorAll(".list-group-item")];
    itemDict = mainList.reduce((itemDict, button) => ({
        ...itemDict,
        [button.getAttribute('data-vote-id')]: button
    }), []);

    dicYear = setList.reduce((dic, item) => ({
        ...dic,
        [item.id]: +item.year
    }), []);

    const layoutRight = document.querySelector('div[slug="polski-top"] .layout__right-column .layout__photo');
    layoutRight.style.right = "auto";
    const layoutPhoto = layoutRight.querySelector('div');
    layoutPhoto.remove();

    setList.forEach((item, i) => {
        const {id, isNew, rank, change, year, years, vote, groupId, history} = item;
        const button = itemDict[id];
        const element = button.querySelector('.vote-item');
        const label = element.querySelector('label');

        if (isNew) {
            label.insertAdjacentHTML('afterend', tagNew);
        }

        const tagYear = getTagLog(year, rank, change);
        element.insertAdjacentHTML('beforeend', tagYear);

        if (vote) {
            element.querySelector('input')?.click();
        }

        if (history) {
            layoutRight.insertAdjacentHTML('afterbegin', `<div id="chart-${i}" class="ct-chart" hidden></div>`);
            const chart = layoutRight.querySelector(`#chart-${i}`);
            button.addEventListener('mouseover', (e) => { chart.hidden = false });
            button.addEventListener('mouseout', (e) => { chart.hidden = true });

            const labels = [...Array(listNo-1).keys()].map(x => (x + 2021));
            const series = history.split(",").map(x => -x || null);

            new window.Chartist.Line(chart, {
                labels: labels,
                series: [ series ]
            }, {
                height: '550px',
                width: '550px',
                fullWidth: false,
                fillHoles: false,
                axisY: {
                    low: -375,
                    high: -1,
                    onlyInteger: true,
                    labelInterpolationFnc: value => -value
                }
            });
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

    listIsNew = setList.reduce((list, item) => item.isNew ? [...list, item.id] : list, []);
    listVoted = setList.reduce((list, item) => item.votes ? [...list, item.id] : list, []);
    listRanked = setList.reduce((list, item) => item.history ? [...list, item.id] : list, []);

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
        hideGroups(!!value);
        listElement.map(item => {
            item.element.hidden = !(item.author.includes(value) || item.title.includes(value));
        });
        if (!value) {
            setGroups();
        } else {
            changeInfoStatus();
        }
    });
}

const addGroups = () => {
    getList(urlGroups).then(groupList => {
        listGroup.classList.toggle('songGroups');
        groupList.forEach(group => {
            dicGroup[group.id].rows.forEach((row, i) => {
                const button = mainList[row];
                button.classList.add("gRow");
                if (i == 0) {
                    group.counter = dicGroup[group.id].songs.reduce((sum, item) => {
                        sum += +item.querySelector('input[type="checkbox"]').checked;
                        return sum;
                    }, 0);

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
                        changeData(storageName, group.id, checked);
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

const setVotedList = (votedList, votedYear, setList) => {
    const checkedItems = [...voteList.querySelectorAll('ul.list-group input[type="checkbox"]:checked')];

    const list = checkedItems.reduce((list, item) => {
        const vid = item.id;
        const songElement = item.parentElement.querySelector('label');
        const songValue = songElement.innerText.replace("\n", " - ");

        return `${list}<li for="${vid}">${songValue}</li>`;
    }, "");

    const selectedIds = checkedItems.map(item => item._value);
    const averageYear = selectedIds.reduce((acc, id) => acc + dicYear[id], 0) / selectedIds.length || 0;
    votedYear.innerText = averageYear.toFixed(0);

    votedList.textContent = null
    votedList.insertAdjacentHTML('beforeend', list);

    const votedItems = [...votedList.querySelectorAll('li')];
    votedItems.forEach(li => {
        li.addEventListener("click", (e) => {
            const forId = e.target.getAttribute("for");
            const input = voteList.querySelector(`#${forId}`);
            input.click();
        });
    });
}

const setVoteSection = (voteList, setList) => {
    const voteSection = document.querySelector('.layout__action');
    voteSection.style.zIndex = 'auto';

    if (voteSection) {
        const cardBody = voteSection.querySelector('.card-body');

        const button = cardBody.querySelector('button');
        button.classList.remove('mb-lg-4');

        button.insertAdjacentHTML('beforebegin', `<div id="averageYear"><span class="vote__text">Średni rok wydania: </span><strong class="vote__year"></strong></div>`);
        const votedYear = cardBody.querySelector('strong.vote__year');

        voteSection.insertAdjacentHTML('beforeend', `<div id="votedList"><ol></ol></div>`);
        votedList = voteSection.querySelector('#votedList ol');

        setVotedList(votedList, votedYear, setList);

        const voteCounter = voteSection.querySelector('.vote__votes');

        const counterObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData') {
                    setVotedList(votedList, votedYear, setList);
                }
            });
        });

        const counterConfig = { characterData: true, subtree: true };

        counterObserver.observe(voteCounter, counterConfig);
    }
}

(function() {
    getList(urlSettings).then(setList => {
        let voteList, listNo;
        let items = [];

        const interval = setInterval(() => {
            if (!voteList) {
                voteList = document.querySelector('.vote-list');

            } else {
                listNo = +document.querySelector('.header__heading-voting').innerText.split('#')[1];

                clearInterval(interval);

                items = [...voteList.querySelectorAll('.list-group-item:not([hidden])')];

                setSearch(voteList, items);
                addTags(listNo, setList);
                addGroups();

                setVoteSection(voteList, setList);
            }
        }, 25);
    });
})();
