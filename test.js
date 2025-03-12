function addTo(a1){
    function addIt(a2){
        return a1 +a2;
    }
    return addIt

}
console.log(addTo(2)(3))


// fetch("https://restcountries.com/v3.1/name/nepal").then(data=>{
//     return data.json();
// }).then(data=>{
//     console.log(data)
// })

async function fetchCountry() {
    try {
        let response = await fetch("https://restcountries.com/v3.1/name/nepal");
        let data = await response.json();
        console.log(data);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Call the function
fetchCountry();