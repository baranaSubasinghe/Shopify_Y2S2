import ProductImageUpload from "@/components/admin-view/image-upload";
import { Button } from "@/components/ui/button";
import { addFeatureImage, getFeatureImages , deleteFeature} from "@/store/common-slice";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";


function AdminDashboard() {
  const [imageFile, setImageFile] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [imageLoadingState, setImageLoadingState] = useState(false);
  const dispatch = useDispatch();
  const { featureImageList } = useSelector((state) => state.commonFeature);

  console.log(uploadedImageUrl, "uploadedImageUrl");

  function handleUploadFeatureImage() {
    dispatch(addFeatureImage(uploadedImageUrl)).then((data) => {
      if (data?.payload?.success) {
        dispatch(getFeatureImages());
        setImageFile(null);
        setUploadedImageUrl("");
      }
    });
  }

 
  useEffect(() => {
    dispatch(getFeatureImages());
  }, [dispatch]);

  
  console.log(featureImageList, "featureImageList");
function handleDeleteFeature(id) {
  if (!confirm("Delete this feature image?")) return;
  dispatch(deleteFeature(id)).then((res) => {
    if (res?.payload?.success) {
      // refresh or rely on reducer update
      dispatch(getFeatureImages());
    }
  });
}
  return (
    <div>
      <ProductImageUpload
        imageFile={imageFile}
        setImageFile={setImageFile}
        uploadedImageUrl={uploadedImageUrl}
        setUploadedImageUrl={setUploadedImageUrl}
        setImageLoadingState={setImageLoadingState}
        imageLoadingState={imageLoadingState}
        isCustomStyling={true}
        // isEditMode={currentEditedId !== null}
      />
      <Button onClick={handleUploadFeatureImage} className="mt-5 w-full">
        Upload
      </Button>
      <div className="flex flex-col gap-4 mt-5">
         {featureImageList && featureImageList.length > 0
  ? featureImageList.map((featureImgItem) => {
       const id = featureImgItem._id || featureImgItem.id;
       return (
        <div key={id} className="relative group">
           <img
             src={featureImgItem.image}
             className="w-full h-[300px] object-cover rounded-t-lg"
             alt="Feature"
           />
          <Button
             variant="destructive"
             size="sm"
             className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
             onClick={() => handleDeleteFeature(id)}
          >
             Delete
           </Button>
         </div>
       );
     })
   : null}
      </div>
      
    </div>
  );
}

export default AdminDashboard;
